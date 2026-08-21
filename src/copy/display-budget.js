import { ownEntry } from "../lookup.js";

// Display copy budgets (ADR 0014 part two, first slice).
//
// Copy written to be read in a feed and copy written to be rendered into an
// image have different constraints. Prose is limited by attention; display
// copy in an image is limited by space. A word limit does not express that,
// because "internationalization" and "we do it" are both one and three words
// but occupy wildly different widths.
//
// The budget is therefore in characters. What the number means changed on
// 2026-08-11, after the first real render.
//
// It was written as a fit ceiling: stay under N characters or the copy will
// not fit. The first run showed the renderer choosing display-size type on
// its own and breaking to three lines, which means type size is chosen to
// fill the zone rather than fixed in advance. A longer string therefore does
// not overflow, it gets smaller.
//
// So the budget is a legibility floor, not a fit ceiling: the most characters
// that can fill the zone while the type stays large enough to read at feed
// scale. The renderer is given proportional design instruction (fill this
// share of the zone, set the supporting line at this fraction of the
// headline) because a model follows compositional relationships more
// reliably than absolute character arithmetic.
//
// REASONED, not verified. The characters-per-line figures below come from
// standard typographic practice (a display line stays readable to roughly
// 30 to 45 characters, and legibility at feed scale means type no smaller
// than about 1/20th of the image height), not from measurement against
// rendered output. They should be corrected once real renders exist. The
// point of shipping them now is to have a budget the renderer is held to,
// so the benchmark measures something specific.

// Each zone describes where authored copy sits and how much room it has.
// A zone is a composition instruction as much as a budget: the render has to
// leave the space, which is why the zone is named in the prompt.
const zones = {
  lower_third: {
    id: "lower_third",
    label: "Lower third",
    description: "across the lower third of the frame, with the subject above it",
    charsPerLine: 34,
  },
  upper_third: {
    id: "upper_third",
    label: "Upper third",
    description: "across the upper third of the frame, with the subject below it",
    charsPerLine: 34,
  },
  left_panel: {
    id: "left_panel",
    label: "Left panel",
    description: "in the left third of the frame, with the subject weighted right",
    charsPerLine: 22,
  },
  center: {
    id: "center",
    label: "Center",
    description: "centered in open space, with the subject framing it",
    charsPerLine: 30,
  },
};

// Lines available per zone, by aspect shape. A 9:16 story has vertical room
// and little width; a 16:9 banner is the reverse.
const linesByShape = {
  square: { lower_third: 3, upper_third: 3, left_panel: 4, center: 3 },
  portrait: { lower_third: 4, upper_third: 4, left_panel: 5, center: 3 },
  tall: { lower_third: 4, upper_third: 4, left_panel: 6, center: 4 },
  landscape: { lower_third: 2, upper_third: 2, left_panel: 4, center: 2 },
};

// Width multiplier: a wider frame fits more characters on a line at the same
// relative type size.
const widthFactorByShape = { square: 1, portrait: 0.9, tall: 0.75, landscape: 1.3 };

// Formats arrive in several shapes: named ratios ("4:5 portrait"), bare
// ratios ("2.4:1"), and pixel dimensions ("1920x800", from the website and
// sales format presets). Dimensions are parsed first, because a website hero
// at 1920x800 matches none of the named ratios and would otherwise fall
// through to square, which is the wrong budget by a wide margin.
function ratioFromFormat(format) {
  const value = String(format || "").toLowerCase().replace(/\s+/g, "");
  const pair = value.match(/(\d+(?:\.\d+)?)\s*[x:×]\s*(\d+(?:\.\d+)?)/);
  if (!pair) return null;
  const width = Number(pair[1]);
  const height = Number(pair[2]);
  if (!width || !height) return null;
  return width / height;
}

export function shapeFromFormat(format) {
  const ratio = ratioFromFormat(format);
  if (ratio) {
    if (ratio <= 0.7) return "tall";
    if (ratio < 0.95) return "portrait";
    if (ratio <= 1.2) return "square";
    return "landscape";
  }
  const value = String(format || "").toLowerCase();
  if (value.includes("story") || value.includes("vertical")) return "tall";
  if (value.includes("portrait")) return "portrait";
  if (value.includes("landscape") || value.includes("banner") || value.includes("wide")) return "landscape";
  return "square";
}

// A very wide banner has almost no vertical room, so lines available in a
// zone shrink even though characters per line grow. Without this a website
// hero would be budgeted as though it had a landscape photo's height.
export function isUltraWide(format) {
  const ratio = ratioFromFormat(format);
  return ratio !== null && ratio >= 2;
}

export function getZone(zoneId) {
  // Own entries only. The zone id arrives on the display copy request and is
  // not checked against this map anywhere upstream, so a bare zones[zoneId]
  // would resolve inherited properties and return something with no width
  // fractions, no label, and no description to the budget and prompt paths.
  return ownEntry(zones, zoneId, zones.lower_third);
}

export function listZones() {
  return Object.values(zones).map((zone) => ({ id: zone.id, label: zone.label }));
}

/**
 * The character budget for one display field in one zone at one format.
 * Returns the per-line width, the line count, and the total, because the
 * prompt needs all three: the renderer is told the string, the zone, and how
 * many lines it may break across.
 */
export function budgetFor({ format, zoneId, share = 1 }) {
  const shape = shapeFromFormat(format);
  const zone = getZone(zoneId);
  const ultraWide = isUltraWide(format);
  const charsPerLine = Math.round(zone.charsPerLine * widthFactorByShape[shape] * (ultraWide ? 1.4 : 1));
  const available = (linesByShape[shape]?.[zone.id] ?? 2) * (ultraWide ? 0.5 : 1);
  const lines = Math.max(1, Math.round(available * share));
  return { charsPerLine, lines, maxChars: charsPerLine * lines, shape, zone: zone.id };
}

// How the three headline fields divide the zone when all are rendered. The
// headline gets the room; the supporting line and CTA are secondary.
const FIELD_SHARE = { headline: 0.5, subhead: 0.35, cta: 0.15 };

// The share of the zone's height each field's type should occupy, and its
// size relative to the headline. These are the instructions that actually
// steer the render; the character budget only guards the floor.
//
// REASONED, not measured. The ratios follow ordinary editorial hierarchy (a
// supporting line around half the headline, a CTA smaller still) rather than
// measurement against rendered output.
const FIELD_DESIGN = {
  headline: { fillShare: 0.7, relativeSize: 1, weight: "bold", note: "the dominant element in the zone" },
  subhead: { fillShare: 0.3, relativeSize: 0.45, weight: "regular", note: "clearly secondary to the headline" },
  cta: { fillShare: 0.15, relativeSize: 0.35, weight: "medium", note: "the smallest element, set apart from the lines above it" },
};

export function designFor(fieldId) {
  return FIELD_DESIGN[fieldId] || FIELD_DESIGN.subhead;
}

/**
 * Budgets for every field of a headline set, given the format and zone.
 * Fields the caller is not rendering are still budgeted, so the copy is
 * usable in a layout tool at the same proportions.
 */
export function displayBudgets({ format, zoneId, fieldIds = ["headline", "subhead", "cta"] }) {
  return fieldIds.map((id) => {
    const budget = budgetFor({ format, zoneId, share: FIELD_SHARE[id] ?? 0.3 });
    return { fieldId: id, ...budget, ...designFor(id) };
  });
}

export function countCharacters(value) {
  return String(value || "").trim().length;
}

/**
 * Check produced fields against their budgets. Deterministic, like the prose
 * check: a string is over budget or it is not, and no model is asked.
 */
export function checkDisplayBudgets(fields, budgets) {
  const byField = new Map(budgets.map((budget) => [budget.fieldId, budget]));
  return fields
    .map((field) => {
      const budget = byField.get(field.id);
      if (!budget || !field.text) return null;
      const length = countCharacters(field.text);
      if (length <= budget.maxChars) return null;
      return {
        severity: "review",
        kind: "display_budget",
        field: field.label,
        rule: `${field.label} stays readable up to about ${budget.maxChars} characters in the ${getZone(budget.zone).label.toLowerCase()} at this format.`,
        sentence: field.text,
        reason: `This line is ${length} characters. The type is sized to fill the space, so a longer line does not overflow, it gets smaller. At this length it will set below comfortable reading size at feed scale.`,
      };
    })
    .filter(Boolean);
}
