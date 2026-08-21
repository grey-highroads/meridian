import {
  protectionBlock,
  inferPackageFormat,
  neutralizeStateLanguage,
  inferScreenBearing,
  neutralizeScreenOrientation,
  auditConstraints,
  displayCopyBlock,
  CAPTURE_CHARACTER,
  humanTexture,
} from "./prompt-craft.js";
import { getZone } from "../copy/display-budget.js";
import { resolveLook, lookResolvesFineDetail } from "./looks.js";
import { buildJobScope, arrayScopeAppliesToJob } from "../scope/resolver.js";
import { ownEntry } from "../lookup.js";

const guidanceOrder = ["foundation", "identity", "world", "creative", "rules"];

// Template compilation uses a subset of guidance. World and creative storytelling
// push the model toward narrative scenes with focal subjects. Templates need
// abstract branded surfaces, so those sections are replaced with template-specific
// production instructions.
const templateGuidanceOrder = ["foundation", "identity", "rules"];

const templateProductionInstructions = {
  title: "Template production instructions",
  body: [
    "This image is a reusable background surface, not a finished piece.",
    "Compose for reuse: this template will have product images, text blocks, and other elements placed on top of it in a layout tool.",
    "Leave clear, intentional open zones where content will be placed. The brief describes where those zones should be.",
    "Keep the surface abstract, environmental, or textural. Do not include people, products, devices, or narrative scenes.",
    "Do not render any text, lettering, pseudo-text, or letter-like marks anywhere in the image.",
    "Design elements (gradients, geometric shapes, subtle patterns, light effects) should support the brand palette and feel without competing with content that will be layered on top.",
    "The surface should crop well across different aspect ratios if multiple formats are being produced.",
    "Evaluate this template as a foundation: does it make everything placed on top of it look better and more branded?",
  ].join(" "),
};

function buildSalesElementInstructions(hasTemplate) {
  const base = [
    "This image is a polished content element for sales and presentation materials.",
    "The element should look like it was produced by a top-tier design studio: clean lighting, precise rendering, premium materials, subtle reflections and shadows.",
    "For device mockups (phones, tablets, laptops): use a current-generation device, render the screen content clearly and legibly, angle the device naturally, and light it with soft studio lighting.",
    "For product graphics and feature illustrations: keep the visual clean, specific, and informative rather than abstract or decorative.",
  ];
  const backgroundHandling = hasTemplate
    ? [
        "The first supplied image is the approved branded background template. Place the element onto this exact background.",
        "Preserve the template background exactly: do not alter, recolor, redraw, crop, or regenerate it. Keep its existing graphics, colors, and any logos or lockups unchanged.",
        "Position the element within the template's open space, leaving its branded edges and design elements visible. Composite the element so it sits naturally on the surface with appropriate shadow and scale.",
      ]
    : [
        "The element should sit on a clean, simple background (white, light neutral, or brand-colored) so it can be placed directly onto a branded template in a layout tool.",
      ];
  const closing = [
    "Do not include people, lifestyle scenes, or environmental backgrounds. The element is the subject.",
    "Do not invent, redraw, or approximate any brand logo, wordmark, or identity lockup. If a logo is not supplied as an exact asset, do not render one at all.",
    "Do not render any text outside of on-screen UI content. Headlines, labels, and captions will be added in the layout tool.",
    "The element must look premium at the actual output dimensions. Avoid compositions that require zooming to appreciate.",
  ];
  return {
    title: "Sales element production instructions",
    body: [...base, ...backgroundHandling, ...closing].join(" "),
  };
}

// ---------------------------------------------------------------------------
// Deliverable requirements (roadmap item 2)
// ---------------------------------------------------------------------------

const deliverableRequirements = {
  "brand-world-image": [
    { id: "approved-brain", label: "Approved Brand Brain", condition: "always", required: true },
    { id: "creative-direction", label: "Creative direction guidance", condition: "always", required: true, sectionId: "creative" },
    { id: "foundation", label: "Brand foundation guidance", condition: "always", required: true, sectionId: "foundation" },
    { id: "locked-asset", label: "Protected product asset", condition: "when product is visible", required: false },
    { id: "voice-guidance", label: "Voice and messaging guidance", condition: "when text appears", required: false, sectionId: "voice" },
    { id: "identity-guidance", label: "Identity guidance", condition: "always", required: true, sectionId: "identity" },
  ],
  "product-showcase": [
    { id: "approved-brain", label: "Approved Brand Brain", condition: "always", required: true },
    { id: "locked-asset", label: "Protected product asset", condition: "always", required: true },
    { id: "identity-guidance", label: "Identity guidance", condition: "always", required: true, sectionId: "identity" },
    { id: "creative-direction", label: "Creative direction guidance", condition: "always", required: true, sectionId: "creative" },
  ],
};

export function checkRequirements(deliverableId, { approvedBrain, lockedAsset, hasText = false }) {
  const requirements = deliverableRequirements[deliverableId] || deliverableRequirements["brand-world-image"];
  const sectionIds = new Set((approvedBrain?.guidanceSections || []).map((s) => s.id));
  return requirements.map((req) => {
    const active = req.required || (req.condition === "when product is visible" && !!lockedAsset) || (req.condition === "when text appears" && hasText);
    let met = true;
    if (req.id === "approved-brain") met = !!approvedBrain;
    else if (req.id === "locked-asset") met = !!lockedAsset;
    else if (req.sectionId) met = sectionIds.has(req.sectionId);
    return { ...req, active, met: active ? met : true };
  });
}

// ---------------------------------------------------------------------------
// Applicability resolution (roadmap item 3)
// Delegated to src/scope/resolver.js. The shared resolver handles channel,
// placement, product, and campaign axes for both image and copy governance.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Job-specific treatments (roadmap item 1)
// ---------------------------------------------------------------------------

export function resolveTreatments({ approvedBrain, lockedAsset, brief, references = [], productId, campaignId }) {
  const treatments = [];
  const placement = brief?.placement || "";
  const jobScope = buildJobScope({ placement, productId, campaignId });
  const dossier = approvedBrain?.artifacts?.dossier || {};
  const rulesSection = (approvedBrain?.guidanceSections || []).find((s) => s.id === "rules");

  // Locked assets
  if (lockedAsset) {
    treatments.push({
      element: lockedAsset.name || "Protected asset",
      category: "Identity",
      treatment: "locked",
      reason: "Exact file placed without change. Logo, label, proportions, and state are preserved.",
    });
  }

  // Approved claims and guardrails
  for (const guardrail of dossier.guardrails || []) {
    treatments.push({
      element: guardrail.title,
      category: "Creative rules",
      treatment: "locked",
      reason: guardrail.body,
    });
  }

  // Scoped prohibitions from review decisions
  const reviewQuestions = approvedBrain?.reviewQuestions || [];
  for (const question of reviewQuestions) {
    if (question.type !== "brand-rule" || !question.scope?.length) continue;
    const scoped = question.scope.map ? question.scope : [];
    const applies = arrayScopeAppliesToJob(scoped, jobScope);
    if (applies) {
      treatments.push({
        element: question.title || question.statement || "Scoped rule",
        category: "Creative rules",
        treatment: "locked",
        reason: `${question.rationale || question.summary}. Applies to this ${placement || "placement"}.`,
      });
    } else {
      treatments.push({
        element: question.title || question.statement || "Scoped rule",
        category: "Creative rules",
        treatment: "not_needed",
        reason: `This rule is scoped to ${scoped.map((e) => `${Array.isArray(e) ? e[0] : e.label}: ${Array.isArray(e) ? e[1] : e.value}`).join(", ")}. It does not apply to ${placement}.`,
      });
    }
  }

  // Guidance sections: suggested or not needed
  const imageOnlySections = new Set(["voice"]);
  for (const section of approvedBrain?.guidanceSections || []) {
    if (imageOnlySections.has(section.id)) {
      treatments.push({
        element: section.name,
        category: "Brand guidance",
        treatment: "not_needed",
        reason: "This image-only deliverable does not include text. Voice guidance is available if text is added.",
      });
    } else {
      treatments.push({
        element: section.name,
        category: "Brand guidance",
        treatment: "suggested",
        reason: `${section.summary}. The system applies this guidance to shape the result.`,
      });
    }
  }

  // Creative references
  for (const ref of references) {
    treatments.push({
      element: ref.source?.name || ref.name || "Creative source",
      category: "Creative input",
      treatment: "suggested",
      reason: `${ref.influence || "Supporting"} influence for ${ref.role || "style"}. Does not override approved guidance.`,
    });
  }

  // Palette and materials
  if (dossier.palette?.length) {
    treatments.push({
      element: `${approvedBrain.brandName} palette`,
      category: "Identity",
      treatment: "suggested",
      reason: `${dossier.palette.map((c) => `${c.name} (${c.role})`).join(", ")}. Used as the color system for the result.`,
    });
  }
  if (dossier.materials?.length) {
    treatments.push({
      element: "Materials and light",
      category: "Creative direction",
      treatment: "suggested",
      reason: `${dossier.materials.join(", ")}. Shapes the physical feel of the scene.`,
    });
  }

  return treatments;
}

const formatSizes = {
  "4:5 portrait": "1024x1280",
  "1:1 square": "1024x1024",
  "9:16 portrait": "1024x1824",
  "1.91:1 landscape": "1536x800",
  "16:9 landscape": "1536x864",
  "4:3 landscape": "1536x1152",
  // Pinterest. Both sides divisible by 16, ratio within 3:1, pixel count inside
  // the accepted range, and each holds its stated ratio exactly.
  "2:3 portrait": "1024x1536",
  "1:2.1 portrait": "960x2016",
  // Template formats (target-use driven)
  "1080x1080": "1024x1024",
  "1080x1350": "1024x1280",
  "1920x1080": "1536x864",
  "1440x1080": "1536x1152",
  "1700x2200": "1024x1312",
  // Website image formats. gpt-image-2 accepts arbitrary resolutions when both
  // sides are divisible by 16, the ratio is within 3:1, and the pixel count is
  // between 655,360 and 8,294,400. These sizes satisfy all four rules, so each
  // one renders at its delivered dimensions with no resizing step.
  "1920x800": "1920x800",
  "1200x800": "1200x800",
  "1024x768": "1024x768",
  "1024x1024": "1024x1024",
  "1280x672": "1280x672",
};

// The synthesizer stores brandDescription as a complete sentence, and it
// usually opens with the brand name. The template here supplied the subject as
// well, which produced "MycoPop is MycoPop is a functional mushroom energy
// drink." When the description already names the brand, use it as written.
function brandOpener(approvedBrain) {
  const name = cleanText(approvedBrain.brandName);
  const description = cleanText(approvedBrain.brandDescription, "the approved brand");
  const sentence = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(description)
    ? description
    : `${name} is ${description}`;
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

function cleanText(value, fallback = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function requiredText(value, label, maximumLength) {
  const text = cleanText(value);
  if (!text) {
    const error = new Error(`${label} is required.`);
    error.status = 400;
    throw error;
  }
  if (text.length > maximumLength) {
    const error = new Error(`${label} is too long. Keep it under ${maximumLength.toLocaleString()} characters.`);
    error.status = 400;
    throw error;
  }
  return text;
}

function optionalText(value, label, maximumLength) {
  const text = cleanText(value);
  if (text.length > maximumLength) {
    const error = new Error(`${label} is too long. Keep it under ${maximumLength.toLocaleString()} characters.`);
    error.status = 400;
    throw error;
  }
  return text;
}

// Guidance sections are strategic prose written for a person to read. Reciting
// them at synthesized length crowds out the authored scene, which is the part
// that describes the picture. The summary states the position and the
// principles are the actionable direction. The prose paragraphs argue the case
// and the production-use note is briefing advice for a marketer, so neither
// reaches an image model as instruction.
// Palette roles are authored with their evidence attached, which is written
// for a person reading the brain and not for a renderer. "Observed on the lower
// portion of the current can and across product-led social imagery; approximate
// only, not an approved production value" told the renderer nothing it could
// draw and was roughly two thirds of the visual materials section.
function firstClause(text) {
  const clean = cleanText(text);
  if (!clean) return "";
  return clean.split(/[;(]/)[0].replace(/[.,\s]+$/, "").trim();
}

function sectionDirection(section, { compact = false } = {}) {
  const pieces = compact
    ? [section.summary, ...(section.principles || []).map((principle) => `${principle}`)]
    : [
        section.summary,
        ...(section.prose || []),
        ...(section.principles || []).map((principle) => `Principle: ${principle}.`),
        section.productionUse,
      ];
  return pieces.map((piece) => cleanText(piece)).filter(Boolean).join(" ");
}

// The world, compiled from the visual grammar.
//
// ADR 0016 built the grammar to carry a brand's visual world, including
// declared creative ambitions, as concrete visible facts rather than as
// description. Until this commit it reached only the scene writer and never
// the compiled image prompt, so across more than twenty renders the brand
// world arrived thinly or not at all, which is the exact failure ADR 0016
// exists to prevent: the retro gaming ambition surfacing only as a
// prohibition.
//
// It compiles third, immediately after Capture, on the same reasoning that put
// Capture second: an early block of physical facts beats a later one, and the
// world has to be settled before the brand prose arrives.
//
// Authority against the look, owner delegated 2026-08-18: the look owns light
// quality, meaning contrast, falloff, grain, and tonal response, and the
// grammar owns light content, meaning source, color, and time of day. Grammar
// camera entries stay at settings level and never describe character, which is
// the look's. Two systems describing the same property in one prompt is the
// conflict shape this work removes.
const GRAMMAR_SECTION_LABELS = [
  ["people", "People on camera"],
  ["objects", "Objects and era"],
  ["places", "Places and materials"],
  ["light", "Light in this world"],
  ["camera", "Camera"],
];

function worldDirection(approvedBrain) {
  const grammar = approvedBrain?.artifacts?.visualGrammar?.sections;
  if (!grammar || typeof grammar !== "object") return "";

  const blocks = [];
  for (const [key, label] of GRAMMAR_SECTION_LABELS) {
    const entries = Array.isArray(grammar[key]) ? grammar[key] : [];
    const statements = entries
      .map((entry) => {
        const statement = cleanText(typeof entry === "string" ? entry : entry?.statement);
        if (!statement) return "";
        // An ambition compiles at full strength and carries its label, per
        // ADR 0016. Origin never dampens the direction.
        const origin = typeof entry === "string" ? null : entry?.basis?.origin || null;
        return origin === "ambition"
          ? `${statement} This is a direction this brand is reaching for, and it belongs in the frame.`
          : statement;
      })
      .filter(Boolean);
    if (statements.length) blocks.push(`${label}: ${statements.join(" ")}`);
  }
  if (!blocks.length) return "";
  // The block led with its labels and read as description, which is how the
  // world arrived at position three and still lost to a scene at position one.
  // The lead sentence states what it is for.
  return `This is the world this brand's photographs take place in, and it is content that belongs in the frame rather than background. Build the setting, the objects, and the person from what follows. ${blocks.join(" ")}`;
}

// What the brand is not. Instruction that closes off wrong answers leaves the
// rest of the space open, which is the opposite of prescriptive guidance. The
// renderer takes one prompt string and has no negative channel, so these
// compile as avoid-clauses inside the positive prompt.
// ADR 0017 step 4, amended 2026-08-17: the governed protections take over as
// the avoid-clause source once a client has at least one accepted entry, not
// once a document exists. A client mid-ruling keeps the old channel, so the
// transition never dips protection. A client with no protections argument at
// all compiles exactly as it did before this existed.
function rejectsDirection(approvedBrain, activeRefusals = null) {
  const governed = Array.isArray(activeRefusals)
    ? activeRefusals.map((entry) => cleanText(entry?.statement)).filter(Boolean)
    : [];
  if (governed.length) {
    return `This brand is not these things, and none of them belong in the frame: ${governed.join(" ")}`;
  }
  const lived = approvedBrain?.artifacts?.livedWorld || approvedBrain?.artifacts?.lived_world;
  const rejects = Array.isArray(lived?.rejects) ? lived.rejects.map((item) => cleanText(item)).filter(Boolean) : [];
  if (!rejects.length) return "";
  return `This brand is not these things, and none of them belong in the frame: ${rejects.join("; ")}.`;
}

// The image prompt needs the product's physical form, its visual direction, and
// its exclusions. Claim wording and substantiation notes govern copy, not
// pictures, and they are the single largest block in the compiled prompt.
function compileProductSectionForImage(product) {
  const parts = [];
  if (product.one_true_thing) {
    parts.push(`This output is for the product "${product.product_name}." ${cleanText(product.one_true_thing)}`);
  } else if (product.product_name) {
    parts.push(`This output is for the product "${product.product_name}."`);
  }
  if (product.visual_direction) parts.push(`Visual direction: ${cleanText(product.visual_direction)}`);
  return parts.join(" ");
}

function referenceDirection(reference) {
  const instruction = cleanText(reference.usageInstruction || reference.source.usage, "Use only as visual inspiration where it supports the approved Brand Brain.");
  const exclusions = cleanText(reference.source.exclusions);
  return `${reference.source.name}. ${reference.influence} influence for ${reference.role}. ${instruction}${exclusions ? ` Do not carry over: ${exclusions}` : ""}`;
}

// Is a person in this frame.
//
// The human texture floor describes what a human being is made of, so it has
// nothing to say to a frame with nobody in it. Until this commit it compiled
// under every look on every scene, which spent roughly a hundred and thirty
// words of a budget this phase exists to reduce on a can sitting on a counter,
// and stated as fact that a face in the frame is asymmetric and zoned when the
// assignment named no face at all.
//
// Three fields are read: the scene, the composition, and the props. The scene
// writer authors people explicitly when the frame has them, and a hand written
// brief names them in the same three places. Lighting is not read, because a
// lighting note describes the source rather than what it falls on.
//
// The word list is deliberately generous and the check is deliberately one
// directional. A false positive costs a texture paragraph on a frame that did
// not need it, which is the behavior at head. A false negative costs a
// slightly plastic face. "human" is deliberately absent from the list: it
// matches "human resources", which is ordinary B2B scene vocabulary, and every
// scene that has an actual person in it names them some other way. Neither failure countermands the brief, which is why
// the same check does not compile an exclusion; see the note on
// `protectionBlock` in prompt-craft.js.
const PERSON_WORDS = new RegExp(
  "\\b(?:person|persons|people|man|men|woman|women|boy|boys|girl|girls|child|children|kid|kids"
    + "|adult|adults|teenager|teenagers|someone|somebody|figure|figures|portrait"
    + "|hand|hands|arm|arms|shoulder|shoulders|face|faces|skin"
    + "|customer|customers|shopper|shoppers|worker|workers|employee|employees|staff|colleague|colleagues"
    + "|barista|bartender|clerk|cashier|guest|guests|crowd|couple|passerby|passersby|bystander|bystanders"
    + "|patient|patients|nurse|nurses|doctor|doctors|clinician|clinicians|athlete|athletes|runner|runners"
    + ")\\b",
  "i",
);

function frameCarriesPeople({ scene, sceneComposition, sceneProps }) {
  return PERSON_WORDS.test([scene, sceneComposition, sceneProps].filter(Boolean).join(" "));
}

export function imageSizeForFormat(format) {
  // Own entries only. The format string arrives from the brief and reaches
  // here unvalidated, and a bare formatSizes[format] would resolve inherited
  // properties and hand a function to the renderer as an image size.
  return ownEntry(formatSizes, format, "1024x1024");
}

export function compileBrandWorldImagePackage({ approvedBrain, brainVersion, brief, references = [], lockedAsset = null, templateAsset = null, campaign = null, product = null, copyOutputs = [], claimsSet = null, displayCopy = null, refusals = null, look = null }) {
  if (!approvedBrain?.brandName || !Array.isArray(approvedBrain.guidanceSections)) {
    const error = new Error("Approve a Brand Brain before generating production work.");
    error.status = 409;
    throw error;
  }

  let scene = requiredText(brief?.scene, "Describe the image", 4000);
  // Camera behaviour, light behaviour, and compositional hierarchy have nowhere
  // to be recorded in a single prose field. When the scene writer authors them
  // separately they are carried separately.
  const sceneComposition = cleanText(brief?.sceneComposition || "");
  const sceneLighting = cleanText(brief?.sceneLighting || "");
  const sceneProps = cleanText(brief?.sceneProps || "");
  const exclusions = optionalText(brief?.exclusions, "The list of things to avoid", 2000);
  const placement = requiredText(brief?.placement, "Placement", 120);
  const format = requiredText(brief?.format, "Format", 120);
  const assetType = cleanText(brief?.assetType) || "scene";
  const bannerHeadline = optionalText(brief?.bannerHeadline, "The headline", 300);
  const bannerTextSide = cleanText(brief?.bannerTextSide);
  const selected = new Map(approvedBrain.guidanceSections.map((section) => [section.id, section]));
  const isTemplate = placement === "Brand template";
  const isSalesEnablement = placement === "Sales enablement";
  const hasTemplate = !!templateAsset;
  // ADR 0016 step 4 established that when a brain carries the grammar, the
  // scene writer takes the grammar's descriptive sections in place of the
  // identity and creative summaries, because the grammar says the same things
  // as visible facts rather than as description. This mirrors that ruling in
  // the compile path: once the world block compiles, the world and creative
  // guidance summaries are a second, vaguer answer to a question already
  // answered, and they stop. Foundation, identity, and rules stay, because
  // they carry positioning and governance rather than visual content.
  const grammarPresent = Boolean(approvedBrain?.artifacts?.visualGrammar?.sections);
  const sceneGuidanceOrder = grammarPresent
    ? guidanceOrder.filter((id) => id !== "world" && id !== "creative")
    : guidanceOrder;
  const activeGuidanceOrder = (isTemplate || isSalesEnablement) ? templateGuidanceOrder : sceneGuidanceOrder;
  const guidance = activeGuidanceOrder.map((id) => selected.get(id)).filter(Boolean);
  const dossier = approvedBrain.artifacts?.dossier || {};

  // Package format inference and state-lock neutralization
  const packageFormat = lockedAsset ? inferPackageFormat(lockedAsset) : null;
  const screenBearing = !isSalesEnablement && !isTemplate && !templateAsset && inferScreenBearing(lockedAsset);
  const sceneMentionsScreens = /\b(phone|smartphone|iphone|tablet|ipad|laptop|computer|monitor|screen|dashboard|device|kiosk|tv|television)\b/i.test(scene || "");
  const screenContentAbstracted = sceneMentionsScreens && !inferScreenBearing(lockedAsset);
  let stateNeutralizations = [];
  let orientationAdjustments = [];
  if (lockedAsset) {
    const result = neutralizeStateLanguage(scene);
    scene = result.text;
    stateNeutralizations = result.changed;
  }
  if (screenBearing) {
    const oriented = neutralizeScreenOrientation(scene);
    scene = oriented.text;
    orientationAdjustments = oriented.changed;
  }

  // Protection block
  const protection = protectionBlock({
    lockedAsset,
    format: packageFormat,
    screenBearing,
    displayCopy,
  });

  const sourceCount = approvedBrain.sourceCount || null;

  // Both this map and textSideCopy below are keyed by values that arrive from
  // a stored campaign record and from the brief, so both are read through
  // ownEntry rather than through a bare lookup with a truthiness fallback.
  const roleInstructions = {
    "continue-direction": "Continue the visual direction of this prior output. Match the overall feeling, light quality, and palette choices while creating a distinct new image.",
    "match-composition": "Match the composition and layout approach of this prior output. The new image should feel structurally similar but with different content.",
    "create-variation": "Create a variation of this prior output. Same essential concept, different execution. The two should feel like siblings.",
    "use-treatment": "Use the same product treatment as this prior output. Match how the product was lit, angled, and placed in the scene.",
    "reference-only": "Use this as a loose reference for mood and atmosphere. The new image does not need to match it directly.",
  };

  // Campaign direction section (compiled when campaign context is provided)
  const campaignSection = campaign?.campaignIdea ? {
    title: "Campaign direction",
    body: [
      `This image is part of the "${cleanText(campaign.name || campaign.campaignIdea)}" campaign.`,
      campaign.campaignIdea ? `Campaign idea: ${cleanText(campaign.campaignIdea)}.` : "",
      campaign.messageTerritory ? `Message territory: ${cleanText(campaign.messageTerritory)}.` : "",
      campaign.objective ? `Objective: ${cleanText(campaign.objective)}.` : "",
      campaign.audience ? `Audience: ${cleanText(campaign.audience)}.` : "",
      campaign.desiredBelief ? `The image should move the viewer toward believing: ${cleanText(campaign.desiredBelief)}.` : "",
      campaign.explore ? `Explore for this campaign: ${cleanText(campaign.explore)}.` : "",
      campaign.preserve ? `Preserve from the brand: ${cleanText(campaign.preserve)}.` : "",
      campaign.paletteShift ? `Palette shift: ${cleanText(campaign.paletteShift)}.` : "",
    ].filter(Boolean).join(" "),
  } : null;

  // Campaign continuity section (compiled when prior outputs are referenced)
  const priorOutputs = campaign?.priorOutputs?.length ? {
    title: "Campaign continuity",
    body: [
      `This campaign has ${campaign.priorOutputs.length} existing ${campaign.priorOutputs.length === 1 ? "output" : "outputs"}. The new image should feel like it belongs in the same campaign without repeating what already exists.`,
      ...campaign.priorOutputs.map((prior) =>
        `Prior output "${cleanText(prior.label)}" (${cleanText(prior.channel)} ${cleanText(prior.format)}): ${cleanText(prior.scene)}. ${ownEntry(roleInstructions, prior.role, roleInstructions["reference-only"])}`
      ),
    ].join(" "),
  } : null;

  const textSideCopy = {
    "Left third": "Keep the left third of the frame visually quiet. Place the subject and any focal detail in the centre or right so overlaid text stays readable.",
    "Right third": "Keep the right third of the frame visually quiet. Place the subject and any focal detail in the centre or left so overlaid text stays readable.",
    "Lower third": "Keep the lower third of the frame visually quiet. Place the subject in the upper two thirds so overlaid text stays readable.",
    "No text area": "No text will be overlaid. Compose the full frame freely.",
  };

  const compositionSection = assetType === "banner" ? {
    title: "Banner composition",
    body: [
      `This image is a banner. It will be viewed wide and may be cropped tighter on smaller screens, so keep the subject away from the outer edges.`,
      ownEntry(textSideCopy, bannerTextSide, textSideCopy["No text area"]),
      bannerHeadline ? `A headline reading "${bannerHeadline}" will be placed over this image by the layout, so do not render any text into the image itself.` : "",
      `The image should read clearly at a glance rather than rewarding close inspection.`,
    ].filter(Boolean).join(" "),
  } : assetType === "product" ? {
    title: "Product placement",
    body: `The supplied product image is the subject of this frame. Build the surrounding scene so the product sits naturally within it at a believable scale, lit by the same light as the rest of the environment. Do not crop, rotate, restyle, or reinterpret the product itself.`,
  } : null;

  // A selected look replaces the shared capture floor rather than stacking on
  // it. Two finish descriptions in one prompt is the conflict shape this work
  // exists to remove; the floor applies when no look has been chosen.
  const selectedLook = resolveLook(look);

  // The human texture floor compiles only when the frame has a person in it,
  // and only at the resolution the selected medium can deliver. Both gates
  // serve one constraint: no two statements inside Capture may make competing
  // claims about the same property.
  const peopleInFrame = frameCarriesPeople({ scene, sceneComposition, sceneProps });
  const humanTextureFloor = peopleInFrame
    ? humanTexture({ resolvesFineDetail: lookResolvesFineDetail(selectedLook) })
    : "";

  // The grammar's places and materials section answers the same question the
  // dossier materials list answers, with scene-bound facts instead of a global
  // vocabulary. When the world compiles, the dossier list stops, because a
  // global material vocabulary in the prompt is where the unexplained wet and
  // glossy surfaces in the 2026-08-17 audit came from.
  const world = worldDirection(approvedBrain);

  const sections = [
    {
      title: "Assignment",
      body: isTemplate
        ? `Create one ${format} reusable brand template surface for ${cleanText(approvedBrain.brandName)}. ${scene}`
        : isSalesEnablement
        ? `Create one ${format} polished content element for ${cleanText(approvedBrain.brandName)} sales materials. ${scene}`
        : [
            // Position one, which the 2026-08-17 audit established outranks
            // everything after it. Until 2026-08-19 an aesthetic mode opening
            // line sat ahead of this sentence and made a framing claim there,
            // above both the look and the scene. ADR 0018 ruling five retired
            // that system, so the section now opens with the assignment itself
            // and the scene follows immediately.
            `Create one ${format} brand world image for ${placement}.`,
            scene,
            sceneComposition ? `Composition: ${sceneComposition}` : "",
            sceneLighting ? `Lighting: ${sceneLighting}` : "",
            sceneProps ? `Present in the scene: ${sceneProps}.` : "",
          ].filter(Boolean).join(" "),
    },
    // Second by design. The 2026-08-17 audit found that a strong early
    // instruction defeats a later one, and finish has to be settled before
    // roughly two thousand words of brand material arrive. Template surfaces
    // and sales elements are excluded: neither is a photograph, and grain and
    // clipped speculars on a gradient backdrop would be a defect.
    (isTemplate || isSalesEnablement) ? null : {
      title: "Capture",
      // The look describes the photograph. The human texture floor describes
      // what a person is made of, so it lives here rather than being restated
      // inside each look. It follows the look so a look's own tonal rules are
      // already established when it arrives, and it is absent entirely when
      // the frame carries nobody.
      body: [selectedLook ? selectedLook.line : CAPTURE_CHARACTER, humanTextureFloor].filter(Boolean).join(" "),
    },
    // Third by design, immediately after Capture and before the brand prose.
    // Templates and sales elements are excluded: neither is a scene, and a
    // world of people, objects, and places has nothing to say to a gradient.
    (isTemplate || isSalesEnablement) ? null : (world ? {
      title: "The world this brand lives in",
      body: world,
    } : null),
    // The scene-invariant middle cut, owner ruling of 2026-08-19. Four sections
    // stop compiling on the scene path: this one, the guidance sections below,
    // Audience and feeling, and Visual materials. The phase 0 baseline measured
    // that roughly nine tenths of a compiled prompt is fixed brand payload that
    // does not change when the scene changes, competing with the two hundred
    // words describing the actual frame, and that the abstract half of that
    // payload has never been visible in a render. The record of what the brand
    // asserts is untouched: treatments, compiledComponents, and the requirement
    // checks all still read the brain exactly as before. Only the prompt stops
    // reciting it. Template and sales-enablement paths are unchanged, since
    // they were not part of the ruling and lean on the identity prose
    // differently. Reversal is one revert commit.
    (isTemplate || isSalesEnablement) ? {
      title: "Brand foundation",
      body: `${brandOpener(approvedBrain)} ${cleanText(dossier.readBody, approvedBrain.synthesisSummary)}`,
    } : null,
    product ? {
      title: "Product knowledge",
      body: compileProductSectionForImage(product),
    } : null,
    ...((isTemplate || isSalesEnablement)
      ? guidance.map((section) => ({ title: section.name, body: sectionDirection(section, { compact: true }) }))
      : []),
    isTemplate ? templateProductionInstructions : null,
    isSalesEnablement ? buildSalesElementInstructions(hasTemplate) : null,
    campaignSection,
    priorOutputs,
    compositionSection,
    // Palette only, and template and sales paths only. The materials line was
    // already suppressed on both paths before this cut, for template and sales
    // because neither is a scene and for the scene path because the world block
    // answers the same question with scene-bound facts.
    (isTemplate || isSalesEnablement) ? {
      title: "Visual materials",
      body: dossier.palette?.length
        ? `Palette: ${dossier.palette.map((color) => `${cleanText(color.name)} (${firstClause(color.role)}, ${cleanText(color.color)})`).join(", ")}.`
        : "",
    } : null,
    (isTemplate || isSalesEnablement) ? null : (rejectsDirection(approvedBrain, refusals) ? {
      title: "What this brand is not",
      body: rejectsDirection(approvedBrain, refusals),
    } : null),
    {
      title: "Creative references",
      body: references.length
        ? `${references.map(referenceDirection).join(" ")} These sources guide only the named qualities and do not replace the approved Brand Brain.`
        : "No creative source image is attached. Resolve open visual choices from the approved Brand Brain.",
    },
    {
      title: "Protection",
      body: [
        protection,
        isTemplate ? "Do not include any people, faces, hands, devices, screens, product packaging, or identifiable objects. The surface must work as a background layer." : "",
        isSalesEnablement && !hasTemplate ? "Do not include people, lifestyle environments, or narrative scenes. The element is the subject, rendered cleanly for placement onto a branded background." : "",
        isSalesEnablement && hasTemplate ? "Do not include people, lifestyle environments, or narrative scenes. Preserve the supplied template background exactly and place the element onto it." : "",
        dossier.guardrails?.length ? dossier.guardrails.map((rule) => `${rule.title}: ${rule.body}`).join(" ") : "",
        product?.exclusions?.length ? product.exclusions.map((ex) => `Product rule: ${ex}`).join(" ") : "",
        exclusions ? `Also avoid: ${exclusions}` : "",
      ].filter(Boolean).join(" "),
    },
    displayCopy && displayCopy.lines?.some((line) => line.text)
      ? {
          title: "Display copy",
          body: displayCopyBlock({ lines: displayCopy.lines, zone: getZone(displayCopy.zoneId), format }),
        }
      : null,
    {
      title: "Output",
      body: isTemplate
        ? `Return one finished background surface only. Compose for ${format}. The result must work as a foundation for placing product images, text, and brand elements on top. It should feel distinctly ${cleanText(approvedBrain.brandName)} rather than generic.`
        : isSalesEnablement
        ? (hasTemplate
          ? `Return one finished composite only. Compose for ${format}. The element sits on the supplied branded template, which is preserved exactly. The result is ready to drop into a slide or one-pager. It must look premium and distinctly ${cleanText(approvedBrain.brandName)}.`
          : `Return one polished content element only. Compose for ${format}. The element should sit on a clean background, ready for placement onto a branded template in a slide or one-pager. It must look premium and distinctly ${cleanText(approvedBrain.brandName)}.`)
        : `Return one finished image only. Compose for ${format} in ${placement}. Keep the result visually specific, believable, and native to ${cleanText(approvedBrain.brandName)} rather than a generic category image.`,
    },
  ].filter((section) => section && section.body);

  const prompt = sections.map((section) => `${section.title.toUpperCase()}\n${section.body}`).join("\n\n");

  // Constraint audit
  const constraintAudit = auditConstraints({
    guardrails: dossier.guardrails || [],
    exclusions,
    prompt,
  });

  // An approved product carrying open review questions is usable but worth a
  // flag: the reviewer chose to proceed without answering everything.
  const openProductQuestions = product ? (product.review_questions || []).filter((q) => !q.resolution).length : 0;
  if (openProductQuestions > 0) {
    constraintAudit.push({
      rule: `${product.product_name} is approved with ${openProductQuestions} unanswered review ${openProductQuestions === 1 ? "question" : "questions"}. Claims touching those areas deserve a closer look.`,
      status: "warning",
    });
  }

  // Job-specific treatments (roadmap items 1-3)
  const treatments = resolveTreatments({ approvedBrain, lockedAsset, brief: { scene, exclusions, placement, format }, references });
  const requirementCheck = checkRequirements("brand-world-image", { approvedBrain, lockedAsset, hasText: false });
  const unmetRequirements = requirementCheck.filter((r) => r.active && !r.met);
  const ready = unmetRequirements.length === 0;

  return {
    version: "brand-world-image-v2",
    deliverable: "brand-world-image",
    brandName: approvedBrain.brandName,
    brandDescription: approvedBrain.brandDescription,
    brainVersion: Number(brainVersion || 1),
    sourceCount,
    output: { placement, format, size: imageSizeForFormat(format), quantity: 1 },
    brief: { scene, exclusions },
    // The look, carried so the production record can say which medium made
    // this image. It replaces the aestheticMode field, retired with the modes
    // system on 2026-08-19. A record naming a register that no longer compiles
    // is worse than one naming nothing.
    look: selectedLook ? { id: selectedLook.id, label: selectedLook.label } : null,
    lockedAsset: lockedAsset ? { name: lockedAsset.name, format: packageFormat } : null,
    templateAsset: templateAsset ? { name: templateAsset.name, ratio: templateAsset.ratio } : null,
    stateNeutralizations,
    orientationAdjustments,
    screenContentAbstracted,
    prompt,
    sections,
    compiledComponents: guidance.map((section) => `${section.name} / ${section.summary}`),
    references: references.map((reference) => ({
      id: reference.source.id,
      name: reference.source.name,
      role: reference.role,
      influence: reference.influence,
      usageInstruction: reference.usageInstruction || reference.source.usage,
      fileName: reference.file.name,
      fileType: reference.file.type,
    })),
    constraintAudit,
    treatments,
    requirementCheck,
    ready,
    product: product ? { product_id: product.product_id, product_name: product.product_name, version: product.version, open_questions: openProductQuestions } : null,
    ...compileCopyContract({ copyOutputs, claimsSet, placement, segment: brief?.segment, displayCopy }),
    policy: {
      groundedIn: sourceCount
        ? `Approved Brand Brain v${Number(brainVersion || 1)}, built from ${sourceCount} ${sourceCount === 1 ? "source" : "sources"}`
        : `Approved Brand Brain v${Number(brainVersion || 1)}`,
      flexible: ["scene", "composition", "casting", "lighting", "materials"],
      excluded: ["unapproved readable text", ...(lockedAsset ? [] : ["invented logos or packaging"]), ...(exclusions ? [exclusions] : [])],
    },
  };
}

// ---------------------------------------------------------------------------
// Copy contract (ADR 0014 step 2)
// ---------------------------------------------------------------------------

// A job that declares no copy outputs gets no copy key at all. The compiled
// package for an image-only job is byte-identical to what it was before this
// function existed, which is what the placement-shape parity test asserts.
//
// The contract compiled here is the pre-generation half: which copy types the
// job declared and which claims govern them. Produced text and audit findings
// are written into the same structure after generation, so the saved package
// carries the whole record of what the brand asserted in words.
function compileCopyContract({ copyOutputs, claimsSet, placement, segment, displayCopy }) {
  const declared = Array.isArray(copyOutputs) ? copyOutputs.filter(Boolean) : [];
  if (declared.length === 0) return {};
  const set = claimsSet || { approved: [], prohibited: [], disclosures: [] };
  return {
    copy: {
      placement,
      segment: segment || null,
      declared: declared.map((entry) => (typeof entry === "string" ? { copyTypeId: entry } : entry)),
      governingClaims: {
        approved: (set.approved || []).map((claim) => ({ text: claim.text, source: claim.source, scope: claim.scope })),
        prohibited: (set.prohibited || []).map((claim) => ({ text: claim.text, source: claim.source, scope: claim.scope })),
        disclosures: (set.disclosures || []).map((claim) => ({ text: claim.text, source: claim.source })),
        directives: (set.directives || []).map((claim) => ({ text: claim.text, source: claim.source })),
      },
      // What was asked of the renderer, and what it must reproduce exactly.
      // Recorded so a past output can be checked against the intended string
      // rather than against memory. `verified` stays false until read-back
      // verification exists; it is never set true by assertion.
      display: displayCopy
        ? { zoneId: displayCopy.zoneId, format: displayCopy.format || null, lines: displayCopy.lines, verified: false }
        : null,
      // Claims a missing segment held back. Surfaced so the exclusion is
      // visible rather than silent.
      withheldForSegment: (set.withheldForSegment || []).map((claim) => ({ text: claim.text, segment: claim.segment })),
      produced: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Consumption record and change-impact classification (roadmap item 11)
// ---------------------------------------------------------------------------

export function buildConsumptionRecord(job) {
  if (!job?.generationPackage) return null;
  const pkg = job.generationPackage;
  return {
    jobId: job.jobId,
    completedAt: new Date().toISOString(),
    brandName: pkg.brandName,
    brainVersion: pkg.brainVersion,
    sourceCount: pkg.sourceCount || 0,
    guidanceSections: (pkg.compiledComponents || []).map((c) => c),
    look: pkg.look?.id || null,
    output: { placement: pkg.output?.placement, format: pkg.output?.format },
    lockedAsset: pkg.lockedAsset ? { name: pkg.lockedAsset.name, format: pkg.lockedAsset.format } : null,
    references: (pkg.references || []).map((r) => ({ name: r.name, role: r.role, influence: r.influence })),
    palette: pkg.treatments?.filter((t) => t.element?.includes("palette")).map((t) => t.element) || [],
    appliedRules: pkg.treatments?.filter((t) => t.treatment === "locked" && t.category === "Creative rules").map((t) => t.element) || [],
  };
}

export function classifyChangeImpact(record, currentBrainVersion, changedElements = []) {
  if (!record) return null;
  if (record.brainVersion === currentBrainVersion) {
    return { level: "current", label: "Current", description: `Uses active Brand Brain v${currentBrainVersion}.` };
  }
  // Brain version changed: classify the impact
  if (!changedElements.length) {
    return { level: "review", label: "Review recommended", description: `Made with Brand Brain v${record.brainVersion}. The brain has been updated to v${currentBrainVersion}.` };
  }
  // Check whether the changed elements overlap with what this output consumed
  const consumed = new Set([
    ...(record.guidanceSections || []),
    ...(record.palette || []),
    ...(record.appliedRules || []),
    record.lockedAsset?.name,
  ].filter(Boolean).map((s) => s.toLowerCase()));
  const overlapping = changedElements.filter((el) => {
    const lower = el.toLowerCase();
    for (const c of consumed) {
      if (c.includes(lower) || lower.includes(c)) return true;
    }
    return false;
  });
  if (!overlapping.length) {
    return { level: "unaffected", label: "No impact", description: `Made with Brand Brain v${record.brainVersion}. The v${currentBrainVersion} changes do not affect the elements this output used.` };
  }
  // Determine severity
  const lockedAffected = record.lockedAsset && overlapping.some((el) => el.toLowerCase().includes("asset") || el.toLowerCase().includes("logo") || el.toLowerCase().includes("packag"));
  if (lockedAffected) {
    return { level: "reproduction", label: "Reproduction required", description: `The protected asset has changed since v${record.brainVersion}. This output should be re-produced.`, affected: overlapping };
  }
  const paletteOrIdentity = overlapping.some((el) => el.toLowerCase().includes("palette") || el.toLowerCase().includes("identity") || el.toLowerCase().includes("color"));
  if (paletteOrIdentity) {
    return { level: "update", label: "Update available", description: `${overlapping.join(", ")} changed. A deterministic fix may bring this output current.`, affected: overlapping };
  }
  return { level: "review", label: "Review recommended", description: `${overlapping.join(", ")} changed between v${record.brainVersion} and v${currentBrainVersion}. The visual difference may or may not matter.`, affected: overlapping };
}

