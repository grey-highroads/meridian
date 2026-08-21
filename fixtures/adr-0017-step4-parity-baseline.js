// Pinned copy of src/production/package.js at commit 1c00ac3, the compiler
// immediately before ADR 0017 step 4. It exists so the parity check compares
// against real prior behavior rather than against a description of it. Do not
// edit this file to make a check pass; if the compiler legitimately changes,
// repin it in the same commit and say why.
//
// Only its import paths differ from the original, rewritten to reach the
// shared modules from fixtures/ rather than from src/production/.
//
// Amended 2026-08-19. The aesthetic modes system was retired from
// src/production/prompt-craft.js by ADR 0018 ruling five, so the two functions
// this file imported from there no longer exist. They are inlined below,
// copied verbatim from prompt-craft.js at commit 601853d, which is the last
// commit carrying them and is behavior-identical to the pin at 1c00ac3 since
// neither function changed in between. This is not an edit made to pass a
// check; it removes a dependency a pinned baseline should never have had on a
// module that moves, and the compiled output is unchanged.

const AESTHETIC_MODES = {
  cinematic_film_still: {
    id: "cinematic_film_still",
    name: "Cinematic film still",
    openingLine: "A photograph made in a real environment, framed wide enough to show the place, not a tabletop product photo.",
    bestWhen: "premium, ritual, cinematic, heritage, design-led, or elevated ceremony",
  },
  documentary_lifestyle: {
    id: "documentary_lifestyle",
    name: "Documentary lifestyle",
    openingLine: "An eye-level documentary photograph, observed rather than staged.",
    bestWhen: "documentary, vernacular, casual, observed, people-centric, outdoor, or activity-driven",
  },
  editorial_commercial: {
    id: "editorial_commercial",
    name: "Editorial commercial",
    openingLine: "A composed editorial photograph with considered light and considered framing.",
    bestWhen: "fashion, beauty, considered, magazine, studio, or product-forward without being a packshot",
  },
  vernacular_ugc: {
    id: "vernacular_ugc",
    name: "Vernacular",
    openingLine: "A vernacular photograph in the register of a phone camera in daily life, incidental and immediate, not a commercial frame.",
    bestWhen: "casual, social, phone-camera, daily life, unpolished, or community-driven",
  },
};

const MODE_SIGNAL_PATTERNS = [
  { mode: "documentary_lifestyle", patterns: [/\bdocumentary\b/i, /\bobserved\b/i, /\blifestyle editorial\b/i, /\beye[- ]level\b/i] },
  { mode: "editorial_commercial", patterns: [/\beditorial\b/i, /\bmagazine\b/i, /\bfashion\b/i, /\bconsidered\b/i] },
  { mode: "vernacular_ugc", patterns: [/\bvernacular\b/i, /\bugc\b/i, /\bphone[- ]camera\b/i, /\bincidental\b/i, /\bcasual\b/i] },
];

/**
 * Select an aesthetic mode from creative direction text in the approved brain.
 * Returns cinematic as the fallback, matching PWP's evidence-first default.
 */
function selectAestheticMode(creativeDirectionText) {
  const text = clean(creativeDirectionText);
  if (!text) return AESTHETIC_MODES.cinematic_film_still;

  for (const { mode, patterns } of MODE_SIGNAL_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(text))) {
      return AESTHETIC_MODES[mode];
    }
  }
  return AESTHETIC_MODES.cinematic_film_still;
}

/**
 * Return the opening framing line for the selected mode.
 * For world-only images (no product), strips the "not a tabletop" clause.
 */
function openingLine(mode, hasProduct = false) {
  const line = (mode && mode.openingLine) || AESTHETIC_MODES.cinematic_film_still.openingLine;
  if (hasProduct) return line;
  return line.replace(/,\s*not a tabletop product photo\.?$/i, ".");
}

import {
  protectionBlock,
  inferPackageFormat,
  neutralizeStateLanguage,
  inferScreenBearing,
  neutralizeScreenOrientation,
  auditConstraints,
  displayCopyBlock,
} from "../src/production/prompt-craft.js";
import { getZone } from "../src/copy/display-budget.js";
import { buildJobScope, arrayScopeAppliesToJob } from "../src/scope/resolver.js";

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

// What the brand is not. Instruction that closes off wrong answers leaves the
// rest of the space open, which is the opposite of prescriptive guidance. The
// renderer takes one prompt string and has no negative channel, so these
// compile as avoid-clauses inside the positive prompt.
function rejectsDirection(approvedBrain) {
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

export function imageSizeForFormat(format) {
  return formatSizes[format] || "1024x1024";
}

export function compileBrandWorldImagePackage({ approvedBrain, brainVersion, brief, references = [], lockedAsset = null, templateAsset = null, campaign = null, product = null, copyOutputs = [], claimsSet = null, displayCopy = null }) {
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
  const activeGuidanceOrder = (isTemplate || isSalesEnablement) ? templateGuidanceOrder : guidanceOrder;
  const guidance = activeGuidanceOrder.map((id) => selected.get(id)).filter(Boolean);
  const dossier = approvedBrain.artifacts?.dossier || {};

  // Aesthetic mode from creative direction evidence
  const creativeSection = selected.get("creative");
  const creativeText = creativeSection ? sectionDirection(creativeSection) : "";
  const mode = selectAestheticMode(creativeText);
  const hasProduct = !!lockedAsset;
  const modeOpeningLine = openingLine(mode, hasProduct);

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
    peopleExcluded: false,
    screenBearing,
    displayCopy,
  });

  const sourceCount = approvedBrain.sourceCount || null;

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
        `Prior output "${cleanText(prior.label)}" (${cleanText(prior.channel)} ${cleanText(prior.format)}): ${cleanText(prior.scene)}. ${roleInstructions[prior.role] || roleInstructions["reference-only"]}`
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
      textSideCopy[bannerTextSide] || textSideCopy["No text area"],
      bannerHeadline ? `A headline reading "${bannerHeadline}" will be placed over this image by the layout, so do not render any text into the image itself.` : "",
      `The image should read clearly at a glance rather than rewarding close inspection.`,
    ].filter(Boolean).join(" "),
  } : assetType === "product" ? {
    title: "Product placement",
    body: `The supplied product image is the subject of this frame. Build the surrounding scene so the product sits naturally within it at a believable scale, lit by the same light as the rest of the environment. Do not crop, rotate, restyle, or reinterpret the product itself.`,
  } : null;

  const sections = [
    {
      title: "Assignment",
      body: isTemplate
        ? `Create one ${format} reusable brand template surface for ${cleanText(approvedBrain.brandName)}. ${scene}`
        : isSalesEnablement
        ? `Create one ${format} polished content element for ${cleanText(approvedBrain.brandName)} sales materials. ${scene}`
        : [
            `${modeOpeningLine} Create one ${format} brand world image for ${placement}.`,
            scene,
            sceneComposition ? `Composition: ${sceneComposition}` : "",
            sceneLighting ? `Lighting: ${sceneLighting}` : "",
            sceneProps ? `Present in the scene: ${sceneProps}.` : "",
          ].filter(Boolean).join(" "),
    },
    {
      title: "Brand foundation",
      body: `${brandOpener(approvedBrain)} ${cleanText(dossier.readBody, approvedBrain.synthesisSummary)}`,
    },
    product ? {
      title: "Product knowledge",
      body: compileProductSectionForImage(product),
    } : null,
    ...guidance.map((section) => ({ title: section.name, body: sectionDirection(section, { compact: true }) })),
    isTemplate ? templateProductionInstructions : null,
    isSalesEnablement ? buildSalesElementInstructions(hasTemplate) : null,
    campaignSection,
    priorOutputs,
    compositionSection,
    (isTemplate || isSalesEnablement) ? null : {
      title: "Audience and feeling",
      body: `${cleanText(dossier.audience)} ${cleanText(dossier.desiredFeeling)}`,
    },
    {
      title: "Visual materials",
      body: [
        dossier.palette?.length ? `Palette: ${dossier.palette.map((color) => `${color.name} (${color.role}, ${color.color})`).join(", ")}.` : "",
        (isTemplate || isSalesEnablement) ? "" : (dossier.materials?.length ? `Materials and light: ${dossier.materials.join(", ")}.` : ""),
      ].filter(Boolean).join(" "),
    },
    (isTemplate || isSalesEnablement) ? null : (rejectsDirection(approvedBrain) ? {
      title: "What this brand is not",
      body: rejectsDirection(approvedBrain),
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
    aestheticMode: { id: mode.id, name: mode.name },
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
    aestheticMode: pkg.aestheticMode?.id || null,
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

