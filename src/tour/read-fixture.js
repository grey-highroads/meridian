import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// Reads the committed markdown for a tour off disk.
//
// The app does not fall back to this. A tour is read from the store and nothing
// else, for every account. What the committed files are is a seed: the Admin
// action reads them once and writes the tour into the store, and after that the
// files are a record of where the demo tour came from.
//
// It sits here rather than in api/tour/index.js because the artist route runs
// the seeding action and importing it from another route would drag that whole
// route into this one.

export function tourDirectory(tourId) {
  return join(process.cwd(), "tours", tourId);
}

export async function readTourFixture(tourId, options = {}) {
  const reader = options.reader || readFile;
  const lister = options.lister || readdir;
  const directory = tourDirectory(tourId);
  const tour = await reader(join(directory, "tour.md"), "utf8");
  const names = (await lister(join(directory, "assignments"))).filter((name) => name.endsWith(".md")).sort();
  const assignments = [];
  for (const name of names) assignments.push(await reader(join(directory, "assignments", name), "utf8"));
  return { tour, assignments };
}
