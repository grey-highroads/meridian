/**
 * Production prompt craft layer.
 *
 * Ported from the Product World Preview render-prompt-writer (v13) into
 * Brand World System. These functions shape how approved Brand Brain
 * knowledge becomes a render-ready prompt. The goal: the few rules that
 * exist should be precise enough that everything else stays open.
 *
 * The protection block, integration sentence, and state-lock neutralization
 * went through thirteen PWP iterations. They are carried forward as proven
 * craft, not new invention.
 */

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Format inference
// ---------------------------------------------------------------------------

const FORMAT_NOUN = {
  can: "can",
  pouch: "pouch",
  tub: "tub",
  jar: "jar",
  bottle: "bottle",
  box: "carton",
  cooler: "cooler",
  package: "package",
};

/**
 * Infer the physical package format from a locked asset's name and metadata.
 * Falls back to "package" when no signal is found.
 */
export function inferPackageFormat(lockedAsset) {
  if (!lockedAsset) return "package";
  const hay = [
    lockedAsset.name,
    lockedAsset.assetType,
    lockedAsset.declaredType,
    lockedAsset.fileName,
  ]
    .map(clean)
    .join(" ")
    .toLowerCase();

  if (/\b(jar|gummy|gummies|edible|edibles|softgel|capsule|honey|jam|salve|balm)\b/.test(hay)) return "jar";
  if (/\b(pouch|bag|packet|sachet|wrapper|jerky|granola|chips)\b/.test(hay)) return "pouch";
  if (/\b(can|soda|spritz|seltzer|rtd)\b/.test(hay)) return "can";
  if (/\b(tub|canister|pre[- ]?workout|powder container|protein tub)\b/.test(hay)) return "tub";
  if (/\b(bottle|shooter|squeeze|dropper|tincture|drops|vial|flask)\b/.test(hay)) return "bottle";
  if (/\b(cooler|hard[- ]?cooler|soft[- ]?cooler|ice[- ]?chest)\b/.test(hay)) return "cooler";
  if (/\b(box|carton|case)\b/.test(hay)) return "box";
  return "package";
}

/**
 * Detect whether a locked asset is screen-bearing: a device whose value is
 * its display (phone, tablet, laptop, app mockup, kiosk, TV). Screen-bearing
 * assets carry an orientation contradiction risk: briefs that describe a
 * person using the device imply the screen faces the user, while asset
 * fidelity requires the screen to face the camera.
 */
export function inferScreenBearing(lockedAsset) {
  if (!lockedAsset) return false;
  const hay = [
    lockedAsset.name,
    lockedAsset.assetType,
    lockedAsset.declaredType,
    lockedAsset.fileName,
  ]
    .map(clean)
    .join(" ")
    .toLowerCase();
  return /\b(phone|smartphone|iphone|android|mobile|tablet|ipad|laptop|macbook|computer|monitor|screen|display|device|kiosk|tv|television|watch face|smartwatch|app|ui|interface|mockup|screenshot)\b/.test(hay);
}

// ---------------------------------------------------------------------------
// Integration sentence
// ---------------------------------------------------------------------------

/**
 * One sentence describing how a locked product asset should sit physically
 * in the scene. Format-specific behaviors (condensation on a can, crinkle
 * on a pouch) keep the instruction precise without constraining the world.
 */
export function integrationSentence(format) {
  const base = "natural contact shadow, scene-matched reflected light and color spill, and soft depth of field";
  const formatExtra =
    format === "can" ? " and physically motivated condensation or rim highlights where the scene supports them"
    : format === "pouch" ? " and minor natural pouch crinkle at contact points"
    : format === "bottle" ? " and physically motivated condensation or edge reflection where the scene supports them"
    : "";
  return `Place it physically in the scene with ${base}${formatExtra}.`;
}

// ---------------------------------------------------------------------------
// Protection block
// ---------------------------------------------------------------------------

const STATEFUL_FORMATS = new Set(["can", "jar", "tub", "bottle", "box", "pouch", "cooler"]);
const TEXT_SAFETY = "Any environmental surface that would carry writing (signs, screens, menus, posters, or displays) is blank, abstract, cropped, or defocused beyond reading, with no pseudo-text or letter-like marks anywhere.";

// When authored display copy is rendered into the image, the blanket rule
// above would forbid the very thing being asked for. It is narrowed rather
// than dropped: environmental surfaces stay blank, and exactly one authored
// block is permitted. Recorded as an amendment to ADR 0014 part two, since
// the original position was that no text is rendered at any time.
const TEXT_SAFETY_WITH_DISPLAY_COPY = "Apart from the authored display copy specified below, any environmental surface that would carry writing (signs, screens, menus, posters, or displays) is blank, abstract, cropped, or defocused beyond reading, with no pseudo-text or letter-like marks anywhere. Invent no other words, labels, captions, watermarks, or letter-like marks.";

// Screens are a governed surface, not a set-dressing surface. The blanket
// text safety rules above were written for environmental surfaces and lose
// to the brief when a device is the subject of the scene: the renderer
// fills subject screens with invented interfaces, messages, and named
// organizations, none of which pass through any governance. Recorded in
// the display-copy first-renders evaluation (finding four) and as a
// revision to ADR 0014. The rule: prompt-only screens show abstract
// content; readable screen content enters only as a protected asset.
const SCREEN_CONTENT_RULE =
  "Every device screen in the scene, including a device that is the subject of the shot, shows abstract non-textual content: soft color fields, simple geometry, or an interface defocused beyond reading. No screen carries readable words, numbers, interface labels, charts, messages, notifications, or the name of any organization.";
const SCREEN_CONTENT_RULE_WITH_ASSET =
  "The protected asset's own supplied display is shown exactly as provided. Every other device screen in the scene shows abstract non-textual content: soft color fields, simple geometry, or an interface defocused beyond reading. No other screen carries readable words, numbers, interface labels, charts, messages, notifications, or the name of any organization.";

function screenContentRule(lockedAsset) {
  return inferScreenBearing(lockedAsset) ? SCREEN_CONTENT_RULE_WITH_ASSET : SCREEN_CONTENT_RULE;
}

/**
 * Build the protection block for a production prompt.
 *
 * Three cases:
 * 1. No locked asset: prevent the renderer from inventing products or text.
 * 2. Locked non-product asset (logo, character, photo): preserve identity.
 * 3. Locked product/packaging asset: format-aware preservation with state lock.
 *
 * In all cases the block is compact (three to five sentences) so the world
 * carries the majority of the prompt budget.
 */
const SCREEN_ORIENTATION_LINES = [
  "The device's screen faces the camera directly and remains fully visible and readable in the final frame.",
  "If a person appears with the device, position them so that orientation is physically natural: beside or behind it presenting the screen outward, or viewed over the shoulder so the camera sees the screen as they do.",
  "Never render the device held in a viewing grip with the screen rotated toward the camera, and never show the back of the device to the camera.",
];

// `peopleExcluded` was removed on 2026-08-18. It had been hardcoded false at
// its only call site since the parameter was written, so it never once changed
// a compiled prompt, and it was the last thing in this file that looked like a
// switch and was not one.
//
// It was not rewired to the person check that now gates the human texture
// floor. The two directions fail differently. Omitting a texture paragraph
// from a frame the check missed costs a slightly plastic face. Asserting "no
// people or hands appear in the frame" into a frame the check missed
// countermands a person the brief asked for, and a regex is not a good enough
// witness to give an order that strong. A person who wants nobody in the frame
// has an authored channel already: the brief's exclusions field, which
// compiles verbatim into this same section.
export function protectionBlock({ lockedAsset, format, screenBearing = false, displayCopy = null }) {
  const textSafety = displayCopy ? TEXT_SAFETY_WITH_DISPLAY_COPY : TEXT_SAFETY;
  // Case 1: world-only, no locked asset
  if (!lockedAsset) {
    const lines = [
      "Render only the authored environment and its explicitly approved unbranded environmental objects; introduce no additional focal object or readable identity mark.",
      textSafety,
      SCREEN_CONTENT_RULE,
    ];
    return lines.join(" ");
  }

  const assetName = clean(lockedAsset.name) || clean(lockedAsset.assetType) || "protected asset";
  const isProduct = /^(packaging|product|product_photo|product_render|package|can|bottle|jar|pouch|tub|box|cooler)$/i.test(
    clean(lockedAsset.assetType || lockedAsset.declaredType || format),
  );

  // Case 2: non-product locked asset (logo, character, portrait)
  if (!isProduct) {
    const lines = [
      `Use the supplied ${assetName} as the identity source of truth; preserve its protected subject, marks, proportions, and visible structure unchanged.`,
      "Do not redraw, replace, or reinterpret the protected identity.",
      "Integrate it only through non-destructive environmental light, contact shadow, reflected color, atmosphere, occlusion, and depth effects that do not alter protected identity.",
      textSafety,
      screenContentRule(lockedAsset),
    ];
    if (screenBearing) lines.splice(2, 0, ...SCREEN_ORIENTATION_LINES);
    return lines.join(" ");
  }

  // Case 3: locked product/packaging asset
  const noun = FORMAT_NOUN[format] || "package";
  const lines = [
    // What the reference governs and what the scene governs, split explicitly.
    //
    // This sentence used to read "preserve the supplied package exactly as
    // pictured: logo, label hierarchy, typography, colors, proportions,
    // silhouette, and open or closed state unchanged, fully readable", with the
    // integration line arriving afterward. Colors unchanged and fully readable
    // are absolutes, and the 2026-08-17 audit established that a strong early
    // positive defeats a later qualifier, so the prompt asked for an overlay
    // and then requested integration. Renders came back with the product
    // sitting on the scene at its own exposure, sharper and cleaner than
    // everything around it.
    //
    // The reference governs the artwork and the geometry. The scene governs the
    // light. Saying so is what lets the object be preserved and photographed at
    // the same time.
    `The supplied ${noun} governs artwork and geometry only: the logo, wordmark, typography, label hierarchy, the relationships between its colors, its proportions, and its silhouette are reproduced from the reference and nothing about the design is redrawn or reinterpreted.`,
    `Its exposure, brightness, contrast, and specular highlights are not taken from the reference. They come from this scene. The ${noun} is lit by the same source as everything else in the frame, so the side turned away from that source falls into shadow by the same amount as every other surface at that distance, it picks up color from what is next to it, it casts a contact shadow where it meets the surface it sits on, and it carries the same focus, grain, and tonal response as the rest of the picture rather than being sharper or cleaner than what surrounds it.`,
    `The wordmark stays identifiable. It does not have to be evenly lit or fully legible across its whole surface, and part of it falling into shadow or turning past the light is correct rather than a fault.`,
    // The protected asset is one physical object and the reference covers one
    // instance of it. A scene with people in it invites more, and every extra
    // unit is drawn from memory rather than from the reference, which is where
    // the fabricated lettering comes from. Extra units are allowed, since a
    // person holding the product is a real moment, but only where no invented
    // label can appear on them.
    `Exactly one ${noun} in the frame carries readable branding, and it is the supplied one. If the scene places any further unit of this product anywhere, including in a hand, on a surface, or in the background, that unit is turned away from camera, occluded, cropped, or defocused so that no lettering, wordmark, or label detail is legible on it. Do not draw a second readable ${noun} from memory.`,
  ];
  if (STATEFUL_FORMATS.has(format)) {
    lines.push(
      `The ${noun} is closed and sealed exactly as supplied: lid on, cap on, wrapper intact, contents not exposed. Do not render the ${noun} as opened, tipped, or with contents visible.`,
    );
  }
  if (screenBearing) lines.push(...SCREEN_ORIENTATION_LINES);
  lines.push(integrationSentence(format));
  lines.push(textSafety);
  lines.push(screenContentRule(lockedAsset));
  return lines.join(" ");
}

// ---------------------------------------------------------------------------
// Aesthetic mode library
// ---------------------------------------------------------------------------

// No mode states an output shape. The cinematic line carried "wide" and "in
// landscape framing" from PWP, where every output was landscape. Output shape
// is now resolved per format and the per-format craft direction carries the
// composition consequences, so an opening line asserting landscape contradicted
// a 4:5 portrait job in three other places. The wide-shot intent is kept as a
// framing distance, which is what actually works against a tabletop composition.
// ---------------------------------------------------------------------------
// Capture character
// ---------------------------------------------------------------------------

// Every prompt this system has ever compiled described content and never
// described finish, so the renderer supplied its own: clean tone everywhere,
// recovered shadows, lifted micro-contrast, smoothed skin, harmonized color,
// nothing clipped and nothing lost. That finish is what reads as generated
// regardless of how good the scene underneath it is, and no amount of scene
// direction reaches it.
//
// This block is the finish. It is written as visible consequences rather than
// as settings or as mood, because the reverse-engineering result from the
// 2026-08-17 external audit is that this renderer obeys concrete physical
// facts and ignores perceptual targets. Grain in the shadows is a fact.
// Authentic is not.
//
// It is code, not configuration, per ADR 0018: render capabilities are code.
// When the look library lands it supplies this block per look; until then one
// shared floor applies to every image, which is still an improvement over
// silence.
// The human texture floor.
//
// Faces kept reading as plastic even in frames where the scene, the light, and
// the product had all landed. The looks each said something about skin, but
// they said it as a category: pore texture, uneven color, specular sheen.
// A category is not a fact, and this renderer obeys facts.
//
// What actually separates rendered skin from photographed skin is that real
// skin is zoned. It is red at the nose, ears, cheeks and knuckles, blue or
// green under the eyes, and yellower across the forehead, and those zones do
// not blend evenly into each other. Its sheen is patchy rather than an even
// glow. It carries fine hair that catches light along the jaw and the edge of
// the cheek. Nothing on a face matches its other side.
//
// This compiles for every look rather than living inside each one, because it
// describes what a human being is made of rather than how the photograph was
// taken. Clauses are written to hold in monochrome as well as color: where
// color is absent the zones read as tonal differences instead.
//
// Two changes on 2026-08-18.
//
// It no longer compiles under every look on every scene. It compiles when a
// person is in the frame, which the caller determines. A paragraph about
// pores, iris fibers, and asymmetric eyebrows spent on a product on a table
// is prompt budget taken from the scene, and it invites a face into a frame
// that was never asked to have one.
//
// And each clause now declares whether it needs the medium to resolve fine
// detail. Three looks state plainly that theirs does not: pushed black and
// white reportage says hairs and threads do not resolve into anything but
// texture, drugstore flash says hair and fabric edges never fully resolve,
// and bleach bypass lays coarse grain over everything. Asking those media for
// individual fine hairs, iris fibers, and vessels in the white of an eye is
// asking for two things at once, and a prompt that makes competing claims
// about the same property leaves the renderer to arbitrate. The zoning, the
// sheen, the asymmetry, and the age carried in hands and necks are all
// structural rather than small, and they hold at any resolution, so they
// compile under every look.
const HUMAN_TEXTURE_CLAUSES = [
  { needsFineDetail: false, text: "Skin is not one surface with one color. It runs red at the nostrils, the ears, the cheeks, the knuckles, and anywhere the skin is thin, cooler and slightly blue or green under the eyes and around the jaw, and yellower across the forehead and the bridge of the nose. Those zones meet unevenly and are visible as differences in tone rather than blending into a single even complexion." },
  { needsFineDetail: false, text: "Sheen on skin is patchy rather than an even glow: it sits on the forehead, the nose, the tops of the cheeks, and the point of the chin, and it is absent everywhere else." },
  { needsFineDetail: true, text: "Fine hair catches the light along the jaw, the edge of the cheek, the upper lip, and the hairline, and individual hairs sit out of place rather than lying together." },
  { needsFineDetail: false, text: "The two sides of a face do not match. One eye sits slightly differently from the other, the eyebrows are not the same shape, the mouth rests uneven, and the hairline is irregular." },
  { needsFineDetail: true, text: "Eyes carry visible moisture at the lower lid, faint vessels in the white, and an iris with visible fibers rather than a flat disc. Lips are cracked or dry in places and their edge is not a clean line." },
  { needsFineDetail: false, text: "Hands and necks show their age before faces do: tendons, veins, knuckle creases, and loose skin at the throat are all present and are not smoothed." },
];

/**
 * The human texture floor, compiled for the resolution the selected medium
 * can actually deliver. `resolvesFineDetail` false drops the clauses that ask
 * for individual hairs, iris fibers, and vessels, and keeps everything that
 * survives coarse grain and soft resolution.
 */
export function humanTexture({ resolvesFineDetail = true } = {}) {
  return HUMAN_TEXTURE_CLAUSES.filter((clause) => resolvesFineDetail || !clause.needsFineDetail)
    .map((clause) => clause.text)
    .join(" ");
}

export const CAPTURE_CHARACTER = [
  "This is one exposure made by a physical camera, carrying the losses that come with that.",
  "Grain is present and visible at normal viewing size. It is fine in the bright areas and coarse in the shadows and anywhere underexposed.",
  "The brightest speculars clip to paper white and hold no detail inside them. The deepest shadows fall to near black and keep nothing recoverable. The frame does not hold detail everywhere at once.",
  "One plane is sharp. Everything in front of it and behind it loses edge definition progressively with distance, and faces further back are unresolved rather than merely smaller. Anything moving carries motion softness rather than being frozen.",
  "Skin carries pore texture, uneven color across the cheeks and nose, and specular sheen wherever the face is oily. Stray hair sits out of place. Fabric holds wrinkles and settled creases at the elbows and waist.",
  "Brightness falls off toward the corners. High contrast edges carry faint color fringing. The far edges of the frame are softer than the center.",
  "White balance is imperfect. The frame carries one cast from its dominant source rather than colors corrected into agreement with each other.",
  "This is the file as it came off the card, not a corrected and finished image.",
].join(" ");

// The aesthetic modes system lived here until 2026-08-19, when ADR 0018 ruling
// five retired it in favor of the look library in src/production/looks.js.
// Four modes each carried an opening line that compiled into position one of
// the Assignment section, ahead of everything, where a claim like "framed wide
// enough to show the place" outranked both the look and the scene the person
// actually wrote. Two systems describing the register of the photograph is the
// conflict shape ADR 0018 exists to remove, and the look library is the one
// that stayed. AESTHETIC_MODES, MODE_SIGNAL_PATTERNS, selectAestheticMode, and
// openingLine are gone. The pinned ADR 0017 parity baseline carries its own
// copies, since a baseline should not import from a module that moves.

// ---------------------------------------------------------------------------
// Authored display copy
// ---------------------------------------------------------------------------

/**
 * The block that asks the renderer to draw a specific string.
 *
 * Three things it must communicate, in this order of importance: the exact
 * characters, that they are not to be altered, and where they go. The zone
 * is a composition instruction as much as a placement one, because the
 * render has to leave the space before anything can sit in it.
 *
 * Fidelity is asserted here and not verified here. Read-back verification is
 * specified in ADR 0014 part two and is not built. Until it is, an output
 * carrying rendered copy is unverified and the interface says so.
 */
export function displayCopyBlock({ lines, zone, format }) {
  const rendered = (lines || []).filter((line) => line.text);
  if (!rendered.length) return "";

  const parts = [
    `Render the following authored copy into the image, ${zone.description}, composed as part of the photograph rather than pasted over it.`,
    `Leave clean, uncluttered space in that area when composing the scene so the copy sits legibly without covering the subject.`,
  ];

  for (const line of rendered) {
    parts.push(`${line.label}, set exactly as written with no changes to wording, spelling, capitalization, or punctuation: "${line.text}"`);
  }

  // Proportional instruction rather than absolute measurements. The first
  // real render showed the model choosing display-size type and composing
  // for the zone when told to, so it follows relationships. It does not
  // follow arithmetic, which is why nothing here is stated in pixels.
  const primary = rendered[0];
  parts.push(`Size the type to fill the space it is given rather than sitting small inside it. The ${lowerLabel(primary)} occupies roughly ${Math.round((primary.fillShare ?? 0.7) * 100)} percent of the copy area's height and is the dominant element in the frame's typography.`);

  if (rendered.length > 1) {
    const hierarchy = rendered.slice(1).map((line) =>
      `the ${lowerLabel(line)} sets at about ${Math.round((line.relativeSize ?? 0.45) * 100)} percent of the ${lowerLabel(primary)}'s size, ${line.note || "clearly secondary to it"}`,
    );
    parts.push(`Hold a clear hierarchy: ${hierarchy.join("; ")}. The sizes are relative to each other, so the relationship holds whatever the absolute scale.`);
    parts.push(`Stack the lines as a single typographic group with consistent alignment and even spacing between them, not scattered across the frame.`);
  }

  parts.push(
    `Break lines at phrase boundaries so each line reads as a unit. Never break in the middle of a phrase, and never leave a single word stranded on its own line unless the copy is one word.`,
    `Set the copy in a clean, contemporary sans-serif, aligned consistently, with enough contrast against what sits behind it to stay legible. Keep an even optical margin around the copy so it does not crowd the frame edge or the subject.`,
    `Reproduce every character exactly. Do not paraphrase, translate, abbreviate, re-order, correct, or add to the copy above, and do not repeat it anywhere else in the frame.`,
  );
  if (format) parts.push(`The composition is ${format}; keep the copy clear of the outer edges.`);

  return parts.join(" ");
}

function lowerLabel(line) {
  return String(line?.label || "copy").toLowerCase();
}

// ---------------------------------------------------------------------------
// State-lock neutralization
// ---------------------------------------------------------------------------

const OPEN_WORD = "(?:open|opened)";
const STATE_LOCK_PATTERNS = [
  [new RegExp("\\b(jar|bottle|can|pouch|tub|box|package|container)s?\\s+" + OPEN_WORD + "\\b", "gi"), "$1 closed and sealed"],
  [new RegExp("\\bsits?\\s+" + OPEN_WORD + "\\b", "gi"), "sits"],
  [new RegExp("\\bstands?\\s+" + OPEN_WORD + "\\b", "gi"), "stands"],
  [new RegExp("\\brests?\\s+" + OPEN_WORD + "\\b", "gi"), "rests"],
  [new RegExp("\\bsitting\\s+" + OPEN_WORD + "\\b", "gi"), "sitting"],
  [new RegExp("\\bstanding\\s+" + OPEN_WORD + "\\b", "gi"), "standing"],
  [/\b(the\s+)?lid\s+(?:is\s+)?(?:off|removed|open)\b/gi, "the lid on"],
  [/\b(the\s+)?cap\s+(?:is\s+)?(?:off|removed|open)\b/gi, "the cap on"],
  [/\bwith\s+(the\s+)?(lid|cap)\s+(?:off|removed)\b/gi, "with the $2 on"],
  [/\buncapped\b/gi, "capped"],
  [/\bunsealed\b/gi, "sealed"],
  [/\bunwrapped\b/gi, "wrapped"],
  [/\bpoured\s+out\b/gi, "held ready"],
  [/\bspilled\b/gi, "settled"],
  [/\btipped\s+over\b/gi, "upright"],
  [/\bcontents\s+visible\b/gi, "contents held inside"],
  [/\bcontents\s+spilling\b/gi, "contents held inside"],
];

/**
 * Rewrite scene prose that contradicts a locked asset's physical state.
 * Returns the cleaned text and an array of phrases that were changed.
 * When no locked asset is present, this function should not be called.
 */
export function neutralizeStateLanguage(text) {
  let out = clean(text);
  const changed = [];
  for (const [pattern, replacement] of STATE_LOCK_PATTERNS) {
    const found = out.match(pattern);
    if (found) {
      changed.push(...found);
      out = out.replace(pattern, replacement);
    }
  }
  return { text: out, changed };
}

// ---------------------------------------------------------------------------
// Screen orientation neutralization
// ---------------------------------------------------------------------------

const DEVICE_REF = "(?:the\\s+|a\\s+|her\\s+|his\\s+|their\\s+)?(?:phone|smartphone|iphone|device|tablet|ipad|laptop|screen)";
const SCREEN_ORIENTATION_PATTERNS = [
  // Participle forms keep participle replacements; finite forms keep finite ones,
  // so the rewritten sentence stays grammatical either way.
  [new RegExp("\\b(?:scrolling|swiping)\\s+(?:through|on)\\s+" + DEVICE_REF, "gi"), "presenting the screen toward the camera"],
  [new RegExp("\\b(?:scrolls?|swipes?)\\s+(?:through|on)\\s+" + DEVICE_REF, "gi"), "presents the screen toward the camera"],
  [new RegExp("\\b(?:typing|texting|tapping)\\s+on\\s+" + DEVICE_REF, "gi"), "presenting the screen toward the camera"],
  [new RegExp("\\b(?:types?|texts?|taps?)\\s+on\\s+" + DEVICE_REF, "gi"), "presents the screen toward the camera"],
  [new RegExp("\\b(?:looking|glancing|gazing|staring)\\s+(?:down\\s+)?at\\s+" + DEVICE_REF, "gi"), "holding the screen toward the camera"],
  [new RegExp("\\b(?:looks?|glances?|gazes?|stares?)\\s+(?:down\\s+)?at\\s+" + DEVICE_REF, "gi"), "holds the screen toward the camera"],
  [new RegExp("\\b(?:reading|checking)\\s+" + DEVICE_REF, "gi"), "holding the screen toward the camera"],
  [new RegExp("\\b(?:reads?|checks?)\\s+" + DEVICE_REF, "gi"), "holds the screen toward the camera"],
  [new RegExp("\\busing\\s+" + DEVICE_REF, "gi"), "presenting the screen toward the camera"],
  [new RegExp("\\buses?\\s+" + DEVICE_REF, "gi"), "presents the screen toward the camera"],
];

/**
 * Rewrite brief prose that implies a person is mid-use with a screen-bearing
 * asset. Using-it poses force the screen away from the camera, which
 * contradicts asset fidelity, and the renderer resolves the contradiction
 * by drawing the device backward. Rewrites steer toward presentation poses
 * where a visible screen and a person are simultaneously honest.
 * Returns the cleaned text and an array of phrases that were changed.
 * Only call when the locked asset is screen-bearing.
 */
export function neutralizeScreenOrientation(text) {
  let out = clean(text);
  const changed = [];
  for (const [pattern, replacement] of SCREEN_ORIENTATION_PATTERNS) {
    const found = out.match(pattern);
    if (found) {
      changed.push(...found);
      out = out.replace(pattern, replacement);
    }
  }
  return { text: out, changed };
}

// ---------------------------------------------------------------------------
// Constraint audit
// ---------------------------------------------------------------------------

/**
 * Check every guardrail and user exclusion against the compiled prompt.
 * Returns an array of { rule, source, status } entries.
 *
 * This is a deterministic text check, not a semantic evaluation. It catches
 * explicit contradictions. The human reviewer and any future model-based
 * evaluation handle subtler violations.
 */
export function auditConstraints({ guardrails = [], exclusions = "", prompt = "" }) {
  const audit = [];
  const promptLower = prompt.toLowerCase();

  for (const rule of guardrails) {
    const title = clean(rule.title);
    const body = clean(rule.body);
    if (!title && !body) continue;
    // A guardrail is "carried" if its key terms appear in the prompt.
    // Simple presence check: the guardrail text was compiled into the prompt.
    const carried = promptLower.includes(title.toLowerCase()) || promptLower.includes(body.toLowerCase());
    audit.push({
      rule: title ? `${title}: ${body}` : body,
      source: "Brand Brain guardrail",
      status: carried ? "carried" : "review",
    });
  }

  const exclusionText = clean(exclusions);
  if (exclusionText) {
    const carried = promptLower.includes(exclusionText.toLowerCase());
    audit.push({
      rule: exclusionText,
      source: "Brief exclusion",
      status: carried ? "carried" : "review",
    });
  }

  return audit;
}
