import { parseTourFixture } from "./parse-fixture.js";
import { readTourFixture } from "./read-fixture.js";

// Writes a tour fixture into the tour store through the store's own writers:
// the tour document, its direction, and every assignment under it. The files on
// disk are left where they are.
//
// The tour document is the guard. A second run stops at createTour and writes
// nothing, because the store refuses an id it already holds.
//
// Both the Admin action and the tests that need a tour to work against come
// through here, so a tour a test reads has the same shape a seeded one has.
export async function seedTourFromFixture(tourStore, tourId, options = {}) {
  const texts = options.texts || await readTourFixture(tourId, options);
  const parsed = parseTourFixture(texts);
  await tourStore.createTour(parsed.tour.id, { tour: parsed.tour, assignments: [] });
  await tourStore.addDirection(parsed.tour.id, parsed.tour.direction);
  for (const assignment of parsed.assignments) {
    await tourStore.addRequest(parsed.tour.id, assignment);
  }
  return parsed;
}
