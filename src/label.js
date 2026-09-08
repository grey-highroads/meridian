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

// What a reader calls the thing a project is about. The stored word wins, and a
// subject with none reads its kind: an artist, a venue, an organization. This
// is not which subject has research, which is a different question answered
// elsewhere. Lowercase here, because it lands mid-sentence more often than it
// starts one, and a caller that needs a capital raises the first letter.
const SUBJECT_KINDS = { artist: "artist", venue: "venue", organization: "organization" };

export function subjectWord(record) {
  const stored = readLabel(record, "");
  if (stored) return stored;
  const kind = record && record.kind ? String(record.kind) : "";
  return Object.prototype.hasOwnProperty.call(SUBJECT_KINDS, kind) ? SUBJECT_KINDS[kind] : ARTIST_LABEL;
}
