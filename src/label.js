// What a record is called on screen. A job that is a residency and a subject
// that is a composer read as themselves instead of as Tour and Artist.
//
// The label is text. Nothing keys off it: no shape, no container type, no
// behaviour that varies by which word is stored. A record with nothing stored
// reads the word Meridian has always used, so every record written before this
// landed is unchanged.
//
// Ruled 2026-09-04 in docs/meridian-product-architecture.md.

export const TOUR_LABEL = "Tour";
export const ARTIST_LABEL = "Artist";

// The longest label a rail, a breadcrumb, and a section heading can carry
// without the layout breaking. A longer one is cut rather than refused, so a
// person is never stopped by a limit nobody told them about.
export const LABEL_LIMIT = 40;

// What gets written. An empty label is stored as absence rather than as an
// empty string, so a record someone cleared reads the default the same way a
// record nobody ever labeled does.
export function storedLabel(value) {
  const cleaned = String(value === null || value === undefined ? "" : value).replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, LABEL_LIMIT) : null;
}

// What gets read. Absence, an empty string, and whitespace all resolve to the
// default word.
export function readLabel(record, fallback) {
  const cleaned = String(record && record.label !== null && record.label !== undefined ? record.label : "").trim();
  return cleaned || fallback;
}

export function tourLabel(record) {
  return readLabel(record, TOUR_LABEL);
}

export function artistLabel(record) {
  return readLabel(record, ARTIST_LABEL);
}
