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
