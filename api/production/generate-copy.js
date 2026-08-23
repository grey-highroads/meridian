import { createVercelBlobBrandBrainStore } from "../../src/brand-brain/store.js";
import { createVercelBlobProductStore } from "../../src/products/store.js";
import { createVercelBlobClaimsStore } from "../../src/claims/store.js";
import { assembleClaimsSet, listSegments } from "../../src/claims/assembly.js";
import { buildJobScope } from "../../src/scope/resolver.js";
import { auditCopyAgainstClaims, checkDisclosurePresence } from "../../src/claims/copy-audit.js";
import { produceCopy, auditProducedCopy } from "../../src/copy/generate.js";
import { readJsonBody, requireUser, resolveClientId, sendJson, sendPublicError } from "../../src/server/http.js";
import { OPERATOR_ROLE } from "../../src/org/store.js";
import { resolveLook } from "../../src/production/looks.js";

export default async function handler(request, response) {
  const user = await requireUser(request, response, { role: OPERATOR_ROLE });
  if (!user) return;
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "This route only generates post copy." });
    return;
  }
  try {
    const clientId = resolveClientId(request);
    const body = await readJsonBody(request);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI API key is not configured.");

    // Load the approved brain
    const brainStore = createVercelBlobBrandBrainStore({ clientId });
    const brainState = await brainStore.read();
    if (!brainState?.approvedResult) throw new Error("No approved Brand Brain is available.");
    const brain = brainState.approvedResult;

    // Resolve product record when provided.
    let product = null;
    if (body.productId) {
      const productStore = createVercelBlobProductStore({ clientId });
      product = await productStore.readProduct(body.productId);
      if (!product) throw new Error(`Product "${body.productId}" was not found.`);
      if (!product.approved_at) {
        const error = new Error(`Product "${product.product_name}" has not been approved. Approve it before generating copy from it.`);
        error.status = 409;
        throw error;
      }
    }

    // Scene brief suggestions. Same loaded context as copy generation, so this
    // branch sits here rather than in a new serverless function. The output is
    // job direction for a single image, never brand knowledge: nothing written
    // here is stored, and the user edits or discards it freely.
    if (String(body.action || "") === "scene_brief") {
      await handleSceneBrief({ body, brain, product, apiKey, response });
      return;
    }

    // Copy-type generation (ADR 0014 step 1). The catalog entry supplies the
    // prompt shape; generation and audit are shared code. This dispatches
    // through the existing handler rather than a new serverless function,
    // because the function count sits at the Vercel Hobby ceiling.
    // The segments this client uses, derived from their claims entries. A
    // read, dispatched through this handler because the function count sits
    // at the Vercel Hobby ceiling.
    if (String(body.action || "") === "segments") {
      const store = createVercelBlobClaimsStore({ clientId });
      const document = await store.read();
      sendJson(response, 200, { segments: listSegments(document, store.activeEntries) });
      return;
    }

    // Re-audit copy the user has edited. ADR 0014 part two requires that
    // in-image copy come from a produced-and-audited source; an edited string
    // is only that if it is checked again. This is an audit without a
    // generation call, so an edit costs a claims check and nothing more.
    if (String(body.action || "") === "audit_copy") {
      const claimsStore = createVercelBlobClaimsStore({ clientId });
      const claimsDocument = await claimsStore.read();
      const claimsSet = assembleClaimsSet({
        claimsDocument,
        product,
        activeEntries: claimsStore.activeEntries,
        jobScope: buildJobScope({
          placement: body.placement,
          productId: body.productId,
          campaignId: body.campaignId,
          segment: body.segment,
        }),
      });
      const fields = Array.isArray(body.fields) ? body.fields : [];
      const text = fields.map((field) => field.text).filter(Boolean).join("\n");
      if (!text.trim()) {
        sendJson(response, 400, { error: "There is no copy here to check." });
        return;
      }
      const audit = await auditProducedCopy({ text, claimsSet, apiKey });
      for (const finding of audit.findings || []) {
        if (!finding.sentence) continue;
        const owner = fields.find((field) => field.text && (finding.sentence.includes(field.text) || field.text.includes(finding.sentence)));
        if (owner) finding.field = owner.label;
      }
      sendJson(response, 200, { audit });
      return;
    }

    if (String(body.action || "") === "copy_type") {
      const claimsStore = createVercelBlobClaimsStore({ clientId });
      const claimsDocument = await claimsStore.read();
      const claimsSet = assembleClaimsSet({
        claimsDocument,
        product,
        activeEntries: claimsStore.activeEntries,
        jobScope: buildJobScope({
          placement: body.placement,
          productId: body.productId,
          campaignId: body.campaignId,
          segment: body.segment,
        }),
      });
      const block = await produceCopy({
        copyTypeId: body.copyTypeId,
        brain,
        product,
        claimsSet,
        context: {
          placement: body.placement || "",
          copyDirection: body.copyDirection || "",
          scene: body.scene || "",
          postType: body.postType || "",
          postTopic: body.postTopic || "",
          postClaims: body.postClaims || "",
          postCta: body.postCta || "",
          exclusions: body.exclusions || "",
        },
        apiKey,
      });
      sendJson(response, 200, {
        copy: block,
        governingClaims: {
          approved: claimsSet.approved.map((claim) => ({ text: claim.text, source: claim.source, scope: claim.scope })),
          prohibited: claimsSet.prohibited.map((claim) => ({ text: claim.text, source: claim.source, scope: claim.scope })),
          disclosures: claimsSet.disclosures.map((claim) => ({ text: claim.text, source: claim.source })),
        },
        brainVersion: brainState.brain?.artifactVersion || 1,
      });
      return;
    }

    // Extract guidance sections
    const voice = brain.guidanceSections?.find((s) => s.id === "voice");
    const foundation = brain.guidanceSections?.find((s) => s.id === "foundation");
    const world = brain.guidanceSections?.find((s) => s.id === "world");
    const rules = brain.guidanceSections?.find((s) => s.id === "rules");
    const dossier = brain.artifacts?.dossier || {};

    // Assemble the governed claims set (ADR 0013 derived model).
    // Uses the claims store and assembly function instead of inline assembly.
    const claimsStore = createVercelBlobClaimsStore({ clientId });
    const claimsDocument = await claimsStore.read();
    const jobScope = buildJobScope({
      placement: body.placement,
      productId: body.productId,
      campaignId: body.campaignId,
      segment: body.segment,
    });

    const claimsSet = assembleClaimsSet({
      claimsDocument,
      product,
      activeEntries: claimsStore.activeEntries,
      jobScope,
    });

    // Brain guardrails steer generation through the BOUNDARIES prompt section
    // below but are not injected into the audited prohibited-claims list.
    // Prose rules like "Never clinical" are not claims, and asking the claim
    // auditor to match them adds noise. Guardrail migration into the claims
    // document is future work; until then guardrails steer generation but are
    // not audited as claims.

    // Build the copy-generation prompt
    const systemPromptParts = [
      `You are writing a LinkedIn post for ${brain.brandName} (${brain.brandDescription}).`,
      ``,
      `VOICE AND MESSAGING:`,
      voice ? `${voice.summary}. ${(voice.principles || []).join(". ")}` : "No voice guidance available.",
      ``,
      `BRAND FOUNDATION:`,
      foundation ? `${foundation.summary}. ${(foundation.principles || []).join(". ")}` : "No foundation guidance available.",
      ``,
      world ? `WORLD AND STORY:\n${world.summary}. ${(world.principles || []).join(". ")}` : "",
      ``,
      `BOUNDARIES:`,
      rules ? `${rules.summary}. ${(rules.principles || []).join(". ")}` : "No specific rules.",
      ...(dossier.guardrails || []).map((g) => `- ${g.title}: ${g.body}`),
    ];

    // Inject product knowledge into the generation prompt.
    if (product) {
      systemPromptParts.push(``);
      systemPromptParts.push(`PRODUCT KNOWLEDGE (${product.product_name}):`);
      systemPromptParts.push(product.one_true_thing || "");
      for (const feature of product.features || []) {
        const claim = feature.approved_claim_language
          ? ` Approved claim language: "${feature.approved_claim_language}"`
          : "";
        systemPromptParts.push(`- ${feature.name}: ${feature.benefit}.${claim}`);
      }
    }

    // Prompt-level steering from the assembled claims set.
    if (claimsSet.approved.length > 0) {
      systemPromptParts.push(``);
      systemPromptParts.push(`APPROVED CLAIMS (use these when relevant, do not invent new benefit or capability claims):`);
      for (const claim of claimsSet.approved) {
        systemPromptParts.push(`- "${claim.text}" (${claim.source})`);
      }
    }

    if (claimsSet.prohibited.length > 0) {
      systemPromptParts.push(``);
      systemPromptParts.push(`PROHIBITED CLAIMS AND EXCLUSIONS (never state or imply these):`);
      for (const claim of claimsSet.prohibited) {
        systemPromptParts.push(`- ${claim.text}`);
      }
    }

    if (claimsSet.disclosures.length > 0) {
      systemPromptParts.push(``);
      systemPromptParts.push(`REQUIRED DISCLOSURES (include these when their trigger conditions apply):`);
      for (const disclosure of claimsSet.disclosures) {
        systemPromptParts.push(`- ${disclosure.text}`);
      }
    }

    systemPromptParts.push(
      ``,
      `STRUCTURAL RULES (non-negotiable):`,
      `- No em dashes anywhere. Use commas, periods, or semicolons instead.`,
      `- No fragment stacks ("Simple. Effective. Easy."). Convert to a complete sentence.`,
      `- No "It's not X. It's Y." constructions. Convert first sentence to a dependent clause.`,
      `- No filler intensifiers: "really," "genuinely," "honestly," "straightforward."`,
      `- No hedging verbs. "We bring," not "We try to bring."`,
      `- Peer-to-peer register. Not promotional. Not instructional. The reader should finish with a useful idea.`,
      `- Short sentences need active verbs and a claim that could be disagreed with. No decorative fragments.`,
      ``,
      `OUTPUT FORMAT:`,
      `Return ONLY the post text. No preamble, no explanation, no subject line, no hashtag suggestions unless explicitly asked.`,
      `Keep the post between 150 and 300 words unless the topic demands otherwise.`,
    );

    const systemPrompt = systemPromptParts.filter(Boolean).join("\n");

    const userPrompt = [
      `Post type: ${body.postType || "Thought leadership"}`,
      `Topic: ${body.postTopic || "Write about the brand's perspective on its category."}`,
      body.postClaims ? `Include these approved claims or facts: ${body.postClaims}` : "",
      body.postCta ? `End with this call to action: ${body.postCta}` : "",
      body.exclusions ? `Avoid: ${body.exclusions}` : "",
    ].filter(Boolean).join("\n");

    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!chatResponse.ok) {
      const errorBody = await chatResponse.text();
      throw new Error(`OpenAI returned status ${chatResponse.status}: ${errorBody.slice(0, 200)}`);
    }

    const chatData = await chatResponse.json();
    const postCopy = chatData.choices?.[0]?.message?.content?.trim();
    if (!postCopy) throw new Error("OpenAI returned an empty response.");

    // Post-hoc claim audit. Runs when there are governed claims to check
    // against. Without claims, the endpoint returns the copy alone.
    let claimAudit = null;
    if (claimsSet.approved.length > 0 || claimsSet.prohibited.length > 0) {
      claimAudit = await auditCopyAgainstClaims({
        copy: postCopy,
        approvedClaims: claimsSet.approved,
        prohibitedClaims: claimsSet.prohibited,
        apiKey,
      });
    }

    // Check disclosure presence.
    let disclosureFindings = null;
    if (claimsSet.disclosures.length > 0) {
      disclosureFindings = checkDisclosurePresence(postCopy, claimsSet.disclosures);
    }

    sendJson(response, 200, {
      postCopy,
      model: "gpt-4o",
      brainVersion: brainState.brain?.artifactVersion || 1,
      voiceApplied: !!voice,
      foundationApplied: !!foundation,
      rulesApplied: !!rules,
      productApplied: product ? { product_id: product.product_id, product_name: product.product_name, version: product.version } : null,
      claimsSetSize: { approved: claimsSet.approved.length, prohibited: claimsSet.prohibited.length, disclosures: claimsSet.disclosures.length },
      claimAudit,
      disclosureFindings,
    });
  } catch (error) {
    sendPublicError(response, error);
  }
}

// Claim audit and disclosure presence check imported from src/claims/copy-audit.js.


// Three short scene briefs assembled from the approved brain, the campaign
// context, and the product record. Three rather than one, because a marketer
// who cannot yet describe what they want can still recognize it, and choosing
// between options is a faster way to arrive than editing a single guess.
async function handleSceneBrief({ body, brain, product, apiKey, response }) {
  const dossier = brain.artifacts?.dossier || {};
  const lived = brain.artifacts?.livedWorld || brain.artifacts?.lived_world || {};
  const section = (id) => brain.guidanceSections?.find((s) => s.id === id);
  const world = section("world");
  const identity = section("identity");
  const creative = section("creative");
  const rules = section("rules");
  const campaign = body.campaign || null;

  const drewOn = [];
  const context = [];

  context.push(`BRAND: ${brain.brandName}. ${brain.brandDescription || ""}`);
  if (world) {
    context.push(`WORLD: ${world.summary}. ${(world.principles || []).join(". ")}`);
    drewOn.push("Brand world guidance");
  }
  // ADR 0016 step 4. A brain carrying a visual grammar briefs the scene writer
  // from the grammar's descriptive sections instead of the identity and
  // creative summaries. Per client on artifact presence, per the ADR's
  // transition rule: a brain without the artifact keeps today's assembly
  // exactly, and gets it byte-identical, proven by the parity fixture.
  //
  // The interim identity-principles fix from 1a9357e is superseded on this
  // path and retained on the legacy path below, which is the supersession the
  // ADR's corrected finding anticipated.
  //
  // Rejects are deliberately absent. ADR 0017 made the governed refusals
  // document the only refusal source for the image path, and grammar rejects
  // are never a compile source. The step 1 harness carried a rejects line
  // because it predates that decision; carrying it here would put a second,
  // ungoverned refusal channel back into the prompt.
  const grammarSections = brain.artifacts?.visualGrammar?.sections;
  const grammarMode = Boolean(grammarSections && typeof grammarSections === "object");
  const grammarEntries = [];
  if (grammarMode) {
    // The ambition label travels into the prompt because ADR 0016 requires it
    // to reach the compiled prompt and the result screen rather than stopping
    // at the brain interface. Origin never dampens the direction: an ambition
    // entry compiles at full strength and carries its label.
    const labelled = [
      ["people", "PEOPLE ON CAMERA"],
      ["objects", "OBJECTS AND ERA"],
      ["places", "PLACES AND MATERIALS"],
      ["light", "LIGHT"],
      ["camera", "CAMERA"],
    ];
    for (const [key, label] of labelled) {
      const entries = Array.isArray(grammarSections[key]) ? grammarSections[key] : [];
      if (!entries.length) continue;
      const body = entries
        .map((entry) => {
          const statement = typeof entry === "string" ? entry : entry?.statement || "";
          if (!statement) return "";
          const origin = typeof entry === "string" ? null : entry?.basis?.origin || null;
          grammarEntries.push({ id: (typeof entry === "string" ? null : entry?.id) || null, section: key, statement, origin });
          return origin === "ambition" ? `${statement} (declared ambition for this brand)` : statement;
        })
        .filter(Boolean)
        .join(" ");
      if (body) context.push(`${label}: ${body}`);
    }
    drewOn.push("Visual grammar");
  }
  if (identity && !grammarMode) {
    context.push(`IDENTITY: ${identity.summary}. ${(identity.principles || []).join(". ")}`);
    drewOn.push("Identity guidance");
  }
  if (creative && !grammarMode) {
    context.push(`CREATIVE DIRECTION: ${creative.summary}. ${(creative.principles || []).join(". ")}`);
    drewOn.push("Creative direction");
  }
  const environments = Array.isArray(lived.environments) ? lived.environments : [];
  if (environments.length) {
    context.push(`EARNED ENVIRONMENTS: ${environments.map((e) => `${e.name || e.title || ""}${e.earned ? ` (why the brand belongs: ${e.earned})` : ""}`).filter(Boolean).join("; ")}`);
    drewOn.push("Lived World environments");
  }
  if (lived.person) {
    context.push(`PERSON AT THE CENTER: ${typeof lived.person === "string" ? lived.person : JSON.stringify(lived.person).slice(0, 600)}`);
    drewOn.push("Lived World person");
  }
  if (dossier.desiredFeeling) context.push(`DESIRED FEELING: ${dossier.desiredFeeling}`);
  // Step 1 finding: two channels describe light in the same prompt. When the
  // grammar owns light, the dossier line stops being sent rather than being
  // narrowed, because on one client it was not about light at all: it listed
  // message threads, console views, forms, and canonical asset files. Keeping
  // it beside the grammar's LIGHT section sends the writer two answers.
  if (dossier.materials?.length && !grammarMode) context.push(`MATERIALS AND LIGHT: ${dossier.materials.join(", ")}`);
  if (dossier.palette?.length) context.push(`PALETTE: ${dossier.palette.map((c) => `${c.name} (${c.role})`).join(", ")}`);
  if (rules) {
    context.push(`RULES AND GUARDRAILS: ${rules.summary}. ${(dossier.guardrails || []).map((g) => `${g.title}: ${g.body}`).join(" ")}`);
    drewOn.push("Creative rules and guardrails");
  }
  if (campaign) {
    context.push(`CAMPAIGN: ${campaign.name}. Idea: ${campaign.campaignIdea || ""}. Message territory: ${campaign.messageTerritory || ""}. Audience: ${campaign.audience || ""}. Objective: ${campaign.objective || ""}`);
    drewOn.push(`Campaign: ${campaign.name}`);
  }
  if (product) {
    context.push(`PRODUCT: ${product.product_name}. ${product.one_true_thing || ""} Visual direction: ${product.visual_direction || ""}`);
    if (product.exclusions?.length) context.push(`PRODUCT EXCLUSIONS: ${product.exclusions.join("; ")}`);
    drewOn.push(`Product record: ${product.product_name}`);
    const images = Array.isArray(product.images) ? product.images : [];
    if (images.some((i) => i.kind === "isolated")) drewOn.push("Product image on the record");
  }

  // Each studio category asks for a different kind of artifact, so the task
  // line and the rules change with it. Everything else is shared.
  const kinds = {
    scene: {
      task: "You art direct brand image production. For each direction you write four separate fields: the world, the composition, the lighting, and the props. This is direction for a photographer on set, not marketing copy. Write it the way a director of photography would be briefed.",
      rules: [
        "Describe only what a camera could see. No slogans, no statistics, no claims about the product's performance.",
        "Stay inside the brand's earned environments and guardrails. Do not invent a setting the brand has no reason to be in. When a look above requires a specific condition, choose among the earned environments that can provide it rather than treating the most familiar one as fixed.",
        "The world field carries the place, the person, the moment, and what is happening. Name the hour and the specific physical evidence that the place is used by real people.",
        "When anyone appears behind the subject, give an exact number and make each one different: a different distance from camera, a different direction of travel or facing, and at least one partly hidden behind something. Three people at the same scale walking the same way is a procession, and it is the clearest sign that nobody was actually there.",
        "Each person performs one action, and that action is already underway or just finished. Two simultaneous actions cannot be photographed in one frame: a person cannot stretch and drink at the same time.",
        "Every person in the frame gets a stated mouth and a stated eye direction. Not an adjective, a position: lips closed and relaxed, jaw slack mid exhale, eyes down and left at the screen, eyes on the far end of the hallway. Leaving expression unstated returns a soft pleasant half smile aimed at whatever the person is holding, every time.",
        "A person alone with a task is not enjoying it. Most of the time the correct mouth is closed and unsmiling and the correct eyes are somewhere specific in the room. Reserve a smile for a frame where another person caused it.",
        "Words like natural, candid, effortless, joyful, serene, or unposed describe a feeling you want and give the camera nothing to do.",
        "The composition field carries camera behavior and spatial structure: where the subject sits in frame, camera height, focal length, and what runs from foreground to background.",
        "Depth is an optical fact, not a narrative one. Name the one thing held in sharp focus, then name what loses edge detail and contrast with distance. Do not write that the eye moves through the scene or that focus expands outward; that describes a viewer, not a lens, and it produces a frame that is equally sharp everywhere.",
        "Every composition names one thing the frame cuts and which edge cuts it. This is required, not optional. A crop is a concrete event: the bench runs out of the bottom left corner, the doorway is halved by the right edge. Saying the composition feels unbalanced or observational is not one.",
        "The subject is placed off the center line, horizontally or vertically. A subject centered with matched space on both sides is the single most reliable way to make a photograph look arranged.",
        "The shape guidance you are given describes what survives cropping and where text will sit. It is not an instruction to center the subject or to balance the frame. Where the subject sits inside the shape is yours to decide, and the answer is off center.",
        "In that ranking the person and what they are doing come first and the place they are in comes second. The product is not the first thing the eye lands on and it is not centered on a surface facing the camera. It sits where someone actually set it down or is holding it, inside the moment rather than on top of it.",
        "The product appears once. One unit, in one place, held or set down. Do not populate the scene with several of them.",
        "Compose off center. Give the frame an unbalanced weight, crop something at an edge, and let the camera read as an observation of a moment already happening rather than a setup arranged for it.",
        "The lighting field names one dominant source and its position relative to the camera, in plain terms: behind and to the left, high and in front, through the window at frame right.",
        "Light is selective. Name the specific surfaces that catch the source, and name what is turned away from it and stays in shadow. A frame where everything is lit is a frame with no light in it.",
        "State whether anything returns light into the shadow side, and if nothing does, say so. Do not soften a face because it is the subject.",
        "Never light the whole scene consistently and never give every subject the same edge. A warm glow across the frame, matching tones on everyone present, and a rim on every outline are the same failure: light applied as a finish rather than arriving from somewhere.",
        "The props field is a short list of specific objects present in the scene. Give each one a state and the cause of that state: paint dulled by weather, a seam softened by washing, dust settled in a joint. A state without a cause invites the camera to invent one, which is where unexplained wet and glossy surfaces come from.",
        "Only name surfaces that are in this frame. The brand's material vocabulary is a description of the brand, not a shopping list for every scene.",
        "The three directions must differ in world, not merely in wording.",
        "The brand's creative direction and declared ambitions are direction to follow, not background reading. If the brand has named an aesthetic it is reaching for, one of the three directions should pursue it.",
      ],
    },
    template_surface: {
      task: "You write short briefs for reusable branded background surfaces. A surface is a backdrop that other work sits on top of: a gradient, a texture, a lit environment with open space. It is not a finished image and it has no subject of its own.",
      rules: [
        "Describe the surface, its color behavior, its light, and where the open space sits for elements and text.",
        "No people, no products, no focal subject. Anything placed later needs room.",
        "Use the brand's palette and materials rather than inventing new ones.",
        "The three surfaces must differ in structure or where the open space falls, not merely in wording.",
      ],
    },
    sales_element: {
      task: "You write short briefs for a single generated element that will sit on top of a branded template in sales collateral. The element is one object rendered cleanly: a device mockup, a product shot, a demonstration visual.",
      rules: [
        "Describe the object, its angle, its finish, and its lighting. One object, not a scene.",
        "No text on the object beyond what a real screen or package would carry, and no invented interface copy.",
        "No slogans, no statistics, no claims about the product's performance.",
        "The three briefs must differ in the object or its treatment, not merely in wording.",
      ],
    },
  };
  const kind = kinds[String(body.kind || "scene")] || kinds.scene;

  // The look is chosen before the scene is written, so the scene is authored
  // for the medium rather than handed to it afterward. The look owns capture
  // character; the scene owns content.
  const lookBrief = resolveLook(body.look);

  // ADR 0018. A look that requires a condition to exist has to decide the
  // setting, and it was losing to the earned-environments rule below because
  // that rule sits in the system prompt and the look was only in the user
  // prompt. Three looks failed exactly this way on 2026-08-18: studio seamless
  // returned a living room, overcast editorial returned a dark interior, and
  // daylight street documentary returned a night campfire. Precedence is
  // stated rather than implied, and the earned-environments rule is narrowed
  // to a choice among the environments this medium can photograph.
  // ADR 0018. The grammar reached the writer as context and the writer treated
  // it as background reading, so across more than twenty renders the brand's
  // world arrived thinly or not at all. Context describes; rules oblige. These
  // put the world's content in the RULES block and say plainly that the world
  // is what is in the frame, which is the same precedence fix that repaired
  // looks whose medium required a specific setting.
  const worldSections = grammarMode ? (brain.artifacts?.visualGrammar?.sections || {}) : {};
  const worldHas = (key) => Array.isArray(worldSections[key]) && worldSections[key].length > 0;
  const worldRules = grammarMode
    ? [
        "The sections above headed PEOPLE ON CAMERA, OBJECTS AND ERA, and PLACES AND MATERIALS describe the world this brand's photographs take place in. That world is required content, not background reading. A direction that could have been written for any brand in this category has failed even if it is a good photograph.",
        worldHas("places")
          ? "Build the setting out of the surfaces, rooms, and landscapes named under PLACES AND MATERIALS. Name those materials in the world field. Do not substitute a more familiar room that the brand has no particular claim on."
          : "",
        worldHas("objects")
          ? "Name at least two specific objects from OBJECTS AND ERA in the props field and put at least one of them in the world field where it is doing something in the scene. These are physical objects present in the room, not decoration and not a style applied afterward."
          : "",
        worldHas("people")
          ? "Carry the wardrobe, posture, and era cues from PEOPLE ON CAMERA into how you describe the person."
          : "",
        worldHas("light")
          ? "The sources named under LIGHT are the sources in this scene: name them and their color in the lighting field. Where the look and this world disagree about color, the world decides which sources are present and what color they emit, and the look decides how the film or sensor renders them."
          : "",
        "An entry marked as a declared ambition is a direction the brand is reaching for and it belongs in the frame at full strength. Do not soften it, do not reduce it to a single small prop, and do not leave it out because the scene reads fine without it.",
        "The world decides what is in the frame. The look decides how it was photographed. Neither replaces the other, and a direction that satisfies the look while dropping the world has answered half the brief.",
      ].filter(Boolean)
    : [];

  const lookRules = lookBrief
    ? [
        `This image is made with a specific photographic medium and the direction has to be something that medium can actually produce: ${lookBrief.line}`,
        lookBrief.environment === "binding"
          ? `That medium requires ${lookBrief.requires}. Set the scene somewhere that condition holds. Choose the brand's earned environment that can be photographed this way, or the moment in an earned environment when that condition is true, and if no earned environment can carry it, say so in the label rather than setting the scene somewhere the medium would not work. This requirement outranks the preference for a familiar setting.`
          : "That medium works in any setting, so the environment stays governed by the brand's earned environments.",
        "Do not describe the medium itself in your fields. Capture character compiles separately and repeating it would send the same instruction twice. Write the world, the composition, the lighting, and the props so they belong to that medium: light it renders well, surfaces it resolves, and a moment it can hold.",
      ]
    : [];

  const systemPrompt = [
    kind.task,
    "",
    context.join("\n"),
    "",
    "RULES:",
    ...worldRules.map((rule) => `- ${rule}`),
    ...lookRules.map((rule) => `- ${rule}`),
    ...kind.rules.map((rule) => `- ${rule}`),
    "- No em dashes. No fragment stacks. Plain declarative sentences.",
    "- Write physical facts, not perceptual targets. A camera can be told where a light sits, which surfaces it strikes, how many people are present and which way they face, what is cropped, and what is dry or worn and why. It cannot be told to make something feel authentic, cinematic, elevated, atmospheric, or unposed. Every sentence that does not change what is in front of the lens is a sentence the frame will ignore.",
    String(body.kind || "scene") === "scene"
      ? "- Two to four sentences per field. Concrete nouns over adjectives. Specific over evocative."
      : "- Two or three sentences per brief. Concrete nouns over adjectives.",
    "",
    "OUTPUT FORMAT:",
    String(body.kind || "scene") === "scene"
      ? 'Return only JSON: {"options":[{"label":"three or four words","brief":"the world field","composition":"the composition field","lighting":"the lighting field","props":"comma separated objects"}]} with exactly three options. The world field is the key named brief; there is no key named world. No markdown fences, no preamble.'
      : 'Return only JSON: {"options":[{"label":"three or four words","brief":"the description"}]} with exactly three options. No markdown fences, no preamble.',
  ].join("\n");

  const userPrompt = [
    body.placementLabel ? `The output is a ${body.placementLabel}${body.placementRatio ? ` at ${body.placementRatio}` : ""}.` : "",
    body.placementCraft ? `Composition for this shape: ${body.placementCraft}` : "",
    body.hint ? `The user has started describing it: ${body.hint}` : "Propose three directions the brand could credibly take.",
  ].filter(Boolean).join("\n");

  const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: String(body.kind || "scene") === "scene" ? 2200 : 800,
      temperature: 0.9,
    }),
  });
  if (!chatResponse.ok) {
    const errorBody = await chatResponse.text();
    throw new Error(`OpenAI returned status ${chatResponse.status}: ${errorBody.slice(0, 200)}`);
  }
  const chatData = await chatResponse.json();
  const raw = chatData.choices?.[0]?.message?.content?.trim() || "";
  let options = [];
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    options = Array.isArray(parsed.options) ? parsed.options.slice(0, 3) : [];
    // The rules speak of a world field and the shape calls that key brief, so a
    // model following the rules literally emits world, and the card then
    // renders a heading with no body. Accept either rather than relying on the
    // model to resolve our own naming inconsistency.
    options = options.map((option) => (
      option && !option.brief && option.world ? { ...option, brief: option.world } : option
    ));
  } catch {
    throw new Error("The suggestions came back in an unexpected shape. Try again.");
  }
  // An option with no body cannot be selected: the card would show a heading
  // only, and choosing it would write an empty brief, clear the panel, and
  // leave the person back at the generate button with no explanation.
  options = options.filter((option) => option && String(option.brief || "").trim());
  if (!options.length) throw new Error("No suggestions came back. Try again.");

  // The grammar entries that fed the writer travel back with the suggestions, so
  // the job can record which statements shaped the scene and an ambition entry
  // keeps its label all the way to the result screen.
  sendJson(response, 200, {
    options,
    drewOn,
    model: "gpt-4o",
    grammarEntries: grammarEntries.length ? grammarEntries : undefined,
  });
}
