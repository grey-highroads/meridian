// What a record is called on screen, read on the browser side. The server
// stores the word and this reads it; a record with nothing stored reads the
// word Meridian has always used.
//
// The same defaults live in src/label.js for the server. They are stated twice
// because app code never imports the domain layer: src reaches storage, and a
// page that pulled it in would pull that in too.

export const TOUR_LABEL = "Tour";
export const ARTIST_LABEL = "Artist";

export function readLabel(record, fallback) {
  const value = record && record.label !== null && record.label !== undefined ? record.label : "";
  return String(value).trim() || fallback;
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
