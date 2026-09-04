// Reads a tour fixture into the tour layer's objects: the tour, its direction
// stored as given and versioned, and the assignments under it.
//
// Direction is never paraphrased, summarized, or merged with anything the brain
// suggests. It is stored as the block of text it arrived as, with who set it
// and when, and every assignment names which version it was written against.

function fail(message) {
  const error = new Error(message);
  error.status = 422;
  throw error;
}

// A "Label: value" line in the header of a fixture file.
function field(text, label) {
  const match = String(text).match(new RegExp(`^${label}:\\s*(.+)$`, "im"));
  return match ? match[1].trim() : null;
}

// Everything under a heading, up to the next heading at the same level or above.
function section(text, heading) {
  const lines = String(text).split("\n");
  const start = lines.findIndex((line) => new RegExp(`^#{1,3}\\s+${heading}`, "i").test(line));
  if (start === -1) return null;
  const level = (lines[start].match(/^#+/) || ["#"])[0].length;
  const body = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const depth = (lines[index].match(/^(#+)\s/) || [null, ""])[1].length;
    if (depth && depth <= level) break;
    body.push(lines[index]);
  }
  return body.join("\n").trim();
}

// The bullet rows under a heading. Anything that is not a bullet, a note or a
// blank line is left alone.
function rows(text, heading) {
  const block = section(text, heading);
  if (!block) return [];
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

// A date row reads "date | venue | place". A row that carries fewer parts keeps
// what it has rather than being dropped.
export function parseDates(text) {
  return rows(text, "Dates and venues").map((line) => {
    const parts = line.split("|").map((part) => part.trim());
    return { date: parts[0] || null, venue: parts[1] || null, place: parts[2] || null };
  });
}

export function parseThemes(text) {
  return rows(text, "Themes");
}

// An exception row reads "date | venue | what differs there".
function parseVenueExceptions(block) {
  return rows(block, "Venue exceptions").map((line) => {
    const parts = line.split("|").map((part) => part.trim());
    return {
      date: parts[0] || null,
      venue: parts[1] || null,
      text: parts.slice(2).join(" | ").trim() || null,
    };
  });
}

// The production setup: what the show's content plays on, and where a date
// differs from it. It arrives from the production designer, so it is stored as
// given and versioned the same way the direction is, and nothing in the app
// rewrites it. A tour file without this section reads as it always did.
export function parseProductionSetup(text) {
  const heading = String(text).match(/^##\s+Production setup,\s+version\s+(\d+)\s*$/im);
  if (!heading) return null;
  const version = Number(heading[1]);
  const block = section(text, `Production setup, version ${version}`);
  if (!block) return null;
  // The exceptions sit in their own subsection, so the setup's words stop
  // where that subsection starts.
  const words = block
    .split(/^###\s+/m)[0]
    .split("\n")
    .filter((line) => !/^(Supplied by|Supplied on|Stored as given|Playback system)\b/i.test(line))
    .join("\n")
    .trim();
  if (!words) fail("The production setup carries no words.");
  return {
    version,
    suppliedBy: field(block, "Supplied by"),
    suppliedOn: field(block, "Supplied on"),
    // Stored as given.
    words,
    venueExceptions: parseVenueExceptions(block),
  };
}

export function parseTour(text) {
  const title = (String(text).match(/^#\s+(.+)$/m) || [])[1];
  const id = field(text, "Tour id");
  const artistId = field(text, "Artist");
  if (!title || !id || !artistId) fail("A tour file needs a title, a tour id, and an artist.");

  const heading = String(text).match(/^##\s+Direction,\s+version\s+(\d+)\s*$/im);
  if (!heading) fail("A tour file needs a direction with a version.");
  const version = Number(heading[1]);
  const block = section(text, `Direction, version ${version}`);
  if (!block) fail("The direction section is empty.");

  // The director's words are everything after the header lines of the section.
  const words = block
    .split("\n")
    .filter((line) => !/^(Set by|Set on|Stored as given)\b/i.test(line))
    .join("\n")
    .trim();
  if (!words) fail("The direction carries no words.");

  return {
    id,
    version: 1,
    artistId,
    name: title.trim(),
    // What this job is called on screen. A tour file without a Label line
    // reads null and the interface says Tour, so every fixture written before
    // this line existed parses exactly as it did.
    label: field(text, "Label"),
    cycle: field(text, "Cycle"),
    // What the tour plays content back on. Most tours carry their own hardware
    // and configure it per venue, so the playback system is the technical fact
    // a brief needs. Venue and screen profiles are Jim's side in V1.
    playbackSystem: field(text, "Playback system"),
    // What the content plays on, versioned and stored as given beside the
    // direction. Null on a tour whose file predates this section.
    productionSetup: parseProductionSetup(text),
    status: field(text, "Status"),
    // The tour record a tour home reads. Neither of these is direction and
    // neither is interpretation of it.
    dates: parseDates(text),
    themes: parseThemes(text),
    direction: {
      version,
      setBy: field(block, "Set by"),
      setOn: field(block, "Set on"),
      // Stored as given. Nothing in the app rewrites this.
      words,
    },
  };
}

export function parseAssignment(text) {
  const title = (String(text).match(/^#\s+(.+)$/m) || [])[1];
  const id = field(text, "Assignment id");
  const tourId = field(text, "Tour id");
  const versionField = field(text, "Written against direction version");
  const directionVersion = Number(versionField);
  if (!title || !id || !tourId) fail("An assignment file needs a title, an assignment id, and a tour id.");
  // A missing field reads as 0 through Number, and 0 is an integer, so the
  // field's presence is checked before its value.
  if (!versionField || !Number.isInteger(directionVersion) || directionVersion < 1) {
    fail(`Assignment ${id} does not name the direction version it was written against.`);
  }

  const request = section(text, "What we are asking for");
  if (!request) fail(`Assignment ${id} carries no request.`);

  // Required elements are the binding part of the ask. They lead the brief.
  const required = (section(text, "Required elements") || "")
    .split("\n")
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);

  return {
    id,
    version: 1,
    tourId,
    title: title.trim(),
    directionVersion,
    moment: field(text, "Song or moment"),
    identity: field(text, "Identity"),
    requestedBy: field(text, "Asked for by"),
    requestedOn: field(text, "Requested on"),
    status: field(text, "Status"),
    // The tour manager's words, kept as they arrived.
    request,
    requiredElements: required,
  };
}

export function parseTourFixture({ tour, assignments }) {
  const tourObject = parseTour(tour);
  const assignmentObjects = (assignments || []).map((text) => parseAssignment(text));
  for (const assignment of assignmentObjects) {
    if (assignment.tourId !== tourObject.id) {
      fail(`Assignment ${assignment.id} names tour ${assignment.tourId} and sits under ${tourObject.id}.`);
    }
    if (assignment.directionVersion !== tourObject.direction.version) {
      fail(`Assignment ${assignment.id} was written against direction version ${assignment.directionVersion} and this tour is at version ${tourObject.direction.version}.`);
    }
  }
  return { tour: tourObject, assignments: assignmentObjects };
}
