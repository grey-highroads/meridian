// Compiling a brief.
//
// A brief is the one thing that leaves Higher Roads. It says what was asked,
// what is required, which concept was chosen and why, what to avoid, the parts
// of the tour direction someone marked as bearing on this Scene with the
// version they came from, and what the tour plays back on. Once frozen it is never rewritten. Feedback makes a new version.
//
// Order is deliberate. Required elements and the technical target lead;
// latitude and meaning trail. That comes from a BWS render finding that
// concrete facts placed early beat abstract description placed anywhere. It is
// Reasoned rather than Verified here, because it was a renderer finding and
// Jim's workflow is a different reader. The compiled brief is the cheapest way
// to ask him: hand him a real one and let him say what sits in the wrong place.

// The director's words split into the paragraphs a person marks against. The
// whole direction stays in Meridian. A brief carries the paragraphs someone
// said bear on this Scene, and the version. Ruled 2026-08-22.
export function directionParagraphs(direction) {
  return String((direction && direction.words) || "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

// Selection is by position in that list. An index that is out of range or
// repeated is dropped rather than guessed at.
export function selectedDirectionParagraphs(direction, selection) {
  const all = directionParagraphs(direction);
  const seen = new Set();
  const picked = [];
  for (const entry of Array.isArray(selection) ? selection : []) {
    const index = Number(entry);
    if (!Number.isInteger(index) || index < 0 || index >= all.length || seen.has(index)) continue;
    seen.add(index);
    picked.push(all[index]);
  }
  return picked;
}

export function jobIdFor(tourId, assignmentId) {
  return `${tourId}--${assignmentId}`;
}

export function nextBriefVersion(versions) {
  return versions.reduce((highest, entry) => Math.max(highest, entry.briefVersion || 0), 0) + 1;
}

export function compileBrief({ tour, assignment, concept, artistId, briefVersion }) {
  if (!concept) {
    const error = new Error("Choose or write a concept before compiling a brief.");
    error.status = 400;
    throw error;
  }
  return {
    jobId: jobIdFor(tour.id, assignment.id),
    briefVersion,
    status: "draft",
    artistId,
    tourId: tour.id,
    assignmentId: assignment.id,
    directionVersion: tour.direction.version,

    assignment: {
      title: assignment.title,
      moment: assignment.moment,
      requestedBy: assignment.requestedBy,
      requestedOn: assignment.requestedOn,
      // The tour manager's words, as they arrived.
      request: assignment.request,
    },

    // Binding first.
    requiredElements: assignment.requiredElements || [],
    technicalTarget: {
      playbackSystem: tour.playbackSystem || null,
      // Venue and screen detail sits with Jim in this version. See
      // docs/deferred-work.md for what would bring it here.
      venueProfile: null,
    },

    chosenConcept: {
      title: concept.title,
      idea: concept.idea,
      whyThisArtist: concept.whyThisArtist,
      asksOfProduction: concept.asksOfProduction,
      whereItMightMiss: concept.whereItMightMiss,
      rhymesWith: concept.rhymesWith || [],
      shapedBy: concept.shapedBy || null,
      shapedAt: concept.shapedAt || null,
      cameFrom: concept.cameFrom || null,
    },

    avoid: avoidText(concept.avoid),

    // Every claim about the artist carries what it rests on.
    artistContext: (concept.artistContext || []).map((entry) => ({
      findingId: entry.findingId,
      part: entry.facetName,
      text: findingSentence(entry.text),
      why: entry.why || null,
      independentSourceCount: entry.independentSourceCount,
      tiers: entry.tiers || [],
    })),

    // Meaning last.
    tourDirection: {
      version: tour.direction.version,
      setBy: tour.direction.setBy,
      setOn: tour.direction.setOn,
      // The marked paragraphs, carried as given. Never the whole text.
      selectedParagraphs: selectedDirectionParagraphs(tour.direction, concept.directionParagraphs),
      selectedBy: concept.directionSelectedBy || null,
    },
    creativeLatitude: concept.creativeLatitude || [],
    openQuestions: concept.openQuestions || [],

    frozenBy: null,
    frozenAt: null,
  };
}

export function freeze(brief, person) {
  if (brief.status === "frozen") {
    const error = new Error("That brief version is already frozen.");
    error.status = 409;
    throw error;
  }
  return { ...brief, status: "frozen", frozenBy: person || "Higher Roads", frozenAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// The two artifact forms
// ---------------------------------------------------------------------------

// A finding's text ends with the sentence the intake file used to record its
// evidence and its bin, for example "5 sources, tier 3. New." The brief states
// the evidence in its own line and the bin is our word, not Jim's, so the tail
// comes off rather than being printed twice.
export function findingSentence(text) {
  return String(text)
    .replace(/\*\*/g, "")
    // The tail runs to the end of the entry. Anything after the bookkeeping is
    // the operator writing to Higher Roads, not a fact about the artist.
    .replace(/\s*\d+\s+sources?,\s+tiers?[^.]*\.\s*(Confirmed|Corrected|New)\b[\s\S]*$/i, "")
    .trim();
}

// Higher Roads' own vocabulary never leaves in a brief. An entry that still
// carries it after the bookkeeping is stripped is a record about the intake
// rather than a fact about the artist, so it stays here. See
// docs/deferred-work.md for the one entry this catches today.
const OUR_WORDS = /\b(bin|facet|governance|candidate|proposed|finding-)/i;

export function carriesOurWords(text) {
  return OUR_WORDS.test(String(text));
}

// What the brand avoids arrives from two places: the findings the brain holds
// for this Scene's identity, and any notes the brain wrote about this request.
// Both are text by the time they reach a brief, because a finding id is our
// word and not Jim's.
export function avoidText(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => (typeof entry === "string" ? entry : String((entry && entry.text) || "")))
    .map((text) => findingSentence(text))
    .filter((text) => text && !carriesOurWords(text));
}

function bullets(items) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None recorded.";
}

// What a person reads. Same content as the sidecar, same version, same freeze.
// Neither form is authoritative over the other.
export function renderBriefDocument(brief) {
  const context = brief.artistContext.map((entry) => {
    const sources = entry.independentSourceCount
      ? `${entry.independentSourceCount} independent ${entry.independentSourceCount === 1 ? "source" : "sources"}${entry.tiers.length ? `, tier ${entry.tiers.join(", ")}` : ""}`
      : "source count not recorded";
    return `- ${findingSentence(entry.text)}\n  ${sources}.${entry.why ? ` ${entry.why}` : ""}`;
  });

  return [
    `# ${brief.assignment.title}`,
    "",
    `Job: ${brief.jobId}`,
    `Brief version: ${brief.briefVersion}`,
    `Written against direction version: ${brief.directionVersion}`,
    `Status: ${brief.status === "frozen" ? `Frozen by ${brief.frozenBy} on ${brief.frozenAt}` : "Draft, not yet frozen"}`,
    brief.assignment.moment ? `Moment: ${brief.assignment.moment}` : null,
    brief.assignment.requestedBy ? `Asked for by: ${brief.assignment.requestedBy}` : null,
    "",
    "## Required",
    "",
    bullets(brief.requiredElements),
    "",
    "## Technical target",
    "",
    brief.technicalTarget.playbackSystem || "Not recorded.",
    "",
    "## The concept",
    "",
    `### ${brief.chosenConcept.title}`,
    "",
    brief.chosenConcept.idea,
    brief.chosenConcept.asksOfProduction ? `\nWhat it asks of production: ${brief.chosenConcept.asksOfProduction}` : null,
    brief.chosenConcept.whereItMightMiss ? `\nWhere it might miss: ${brief.chosenConcept.whereItMightMiss}` : null,
    "",
    "## What to avoid",
    "",
    brief.avoid.length ? bullets(brief.avoid) : "Nothing on record that this artist avoids.",
    "",
    "## What was asked for",
    "",
    brief.assignment.request,
    "",
    "## The artist behind this",
    "",
    context.length ? context.join("\n") : "- None recorded.",
    "",
    "## The tour's direction, the parts that bear on this Scene",
    "",
    `Set by ${brief.tourDirection.setBy} on ${brief.tourDirection.setOn}. Version ${brief.tourDirection.version}.`,
    "",
    brief.tourDirection.selectedParagraphs.length
      ? brief.tourDirection.selectedParagraphs.join("\n\n")
      : "No part of the direction was marked for this Scene. The version above is the reference.",
    "",
    "## Latitude",
    "",
    bullets(brief.creativeLatitude),
    brief.openQuestions.length ? "\n## Open questions\n\n" + bullets(brief.openQuestions) : null,
    "",
  ].filter((line) => line !== null).join("\n");
}

// What a machine reads. Provisional on purpose: this shape is Higher Roads'
// guess and is not an obligation on Jim's system until the seam document says
// both sides agreed to it.
export function renderBriefSidecar(brief) {
  return {
    contract: "meridian.brief",
    contractStatus: "provisional, not yet agreed with Jim's side",
    ...brief,
  };
}
