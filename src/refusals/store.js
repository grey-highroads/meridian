// Per-client refusals document. See ADR 0017.
//
// One document per client holding every refusal that governs the brand, ruled
// by a person and surviving every synthesis. Synthesis proposes; it never
// authors. Absence in a synthesis run means nothing and never removes an entry.
//
// This is the sibling of src/claims/store.js, not its extension. Two deliberate
// departures from that module are recorded in the ADR 0017 step 1 gate document:
//
// 1. The lifecycle logic here is a pure document layer with no storage in it,
//    and the blob factory composes it. The claims store's lifecycle is only
//    reachable through a blob call, which is part of why the ADR 0013 mechanism
//    test could not run offline (contract ambient state 10). A gate that must
//    round-trip fixtures needs the operations without the network.
// 2. Deletion does not exist. The claims store's removeEntry marks an entry
//    superseded with no replacement, which is its version of the same rule.
//    Here the equivalent act is retirement, and it is a named status rather
//    than an absence, because a retired protection must stay readable.
//
// Field guidance lives on the shape below rather than in a caller's prompt,
// per the convention recorded in the image pipeline contract stage 1.

export const REFUSALS_SCHEMA_VERSION = "1.0.0";

// The shape, with the constraint that belongs to each field stated on it.
export const ENTRY_FIELDS = {
  id: "Stable identifier. Assigned once at proposal and never reused, reassigned, or regenerated, because rulings and observations point at it.",
  concern:
    "Short plain-language name for what this refusal protects against, distinct from how it is worded. Rulings attach here. Sampling produces paraphrases of the same concern, so the concern is the thing that must stay stable while statements vary.",
  statement:
    "The refusal in visual terms, per the grammar rejects discipline: what a camera would record if the refusal were violated. One refusal per statement.",
  basis:
    "The ADR 0015 object: origin, confidence, derivedFrom. Origin is evidence or inference and never ambition, because a refusal is a rule in force rather than an aim. derivedFrom names the material the refusal actually rests on, including direction sources where a declared direction motivated it.",
  ruling:
    "How a person ruled: decision of accepted or declined, ruled_at timestamp, and proposed_by_run naming the synthesis run that surfaced it. Null decision means nobody has ruled yet.",
  status:
    "One of proposed, active, declined, retired. Declined entries persist so a re-proposed paraphrase can be matched and suppressed rather than re-litigated every rebuild. Retired entries persist so the record of what once governed stays readable.",
  observations:
    "Every later run that surfaced this same concern, appended rather than counted, so an entry absorbing many observations is visible as such.",
  proposed_at: "When the entry entered the document.",
  superseded_at: "Set when a replacement entry takes over. The superseded entry is kept.",
  superseded_by: "Id of the replacement entry, or null when nothing replaced it.",
};

export const STATUSES = ["proposed", "active", "declined", "retired"];
export const ORIGINS = ["evidence", "inference"];

function shortId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toLowerCase();
}

function now() {
  return new Date().toISOString();
}

export function emptyDocument() {
  return {
    schema_version: REFUSALS_SCHEMA_VERSION,
    version: 1,
    updated_at: now(),
    entries: [],
  };
}

export function findEntry(doc, entryId) {
  return (doc.entries || []).find((e) => e.id === entryId) || null;
}

function requireEntry(doc, entryId) {
  const entry = findEntry(doc, entryId);
  if (!entry) {
    throw new Error(`Refusal "${entryId}" not found.`);
  }
  return entry;
}

// Propose a refusal. Every entry enters here, whether a synthesis run surfaced
// it or a person wrote it, so nothing arrives already ruled.
export function proposeEntry(doc, input = {}) {
  if (!input.concern || !String(input.concern).trim()) {
    throw new Error("A refusal needs a concern: what it protects against.");
  }
  if (!input.statement || !String(input.statement).trim()) {
    throw new Error("A refusal needs a statement.");
  }
  const origin = input.basis?.origin;
  if (!ORIGINS.includes(origin)) {
    throw new Error(
      `Refusal origin must be evidence or inference, not "${origin}". A refusal is a rule in force rather than an aim, per ADR 0017.`
    );
  }
  const entry = {
    id: input.id || `ref-${shortId()}`,
    concern: String(input.concern).trim(),
    statement: String(input.statement).trim(),
    basis: {
      origin,
      confidence: input.basis.confidence || null,
      derivedFrom: input.basis.derivedFrom || null,
    },
    ruling: {
      decision: null,
      ruled_at: null,
      ruled_by: input.ruling?.ruled_by || null,
      proposed_by_run: input.ruling?.proposed_by_run || null,
    },
    status: "proposed",
    observations: [],
    proposed_at: input.proposed_at || now(),
    superseded_at: null,
    superseded_by: null,
  };
  if (findEntry(doc, entry.id)) {
    throw new Error(`Refusal id "${entry.id}" is already in this document.`);
  }
  doc.entries.push(entry);
  doc.version += 1;
  return entry;
}

function rule(doc, entryId, decision, options = {}) {
  const entry = requireEntry(doc, entryId);
  if (entry.status === "retired") {
    throw new Error(`Refusal "${entryId}" is retired. Propose a replacement rather than ruling on it again.`);
  }
  entry.ruling = {
    decision,
    ruled_at: options.at || now(),
    ruled_by: options.by || entry.ruling.ruled_by || null,
    proposed_by_run: entry.ruling.proposed_by_run,
  };
  entry.status = decision === "accepted" ? "active" : "declined";
  doc.version += 1;
  return entry;
}

// A person accepts the refusal. It is in force from here.
export function acceptEntry(doc, entryId, options = {}) {
  return rule(doc, entryId, "accepted", options);
}

// A person declines the refusal. It stays in the document so a paraphrase of
// the same concern arriving next rebuild can be suppressed rather than asked
// again. Declines are reversible through acceptEntry.
export function declineEntry(doc, entryId, options = {}) {
  return rule(doc, entryId, "declined", options);
}

// A person retires an active refusal. Human-initiated only; synthesis never
// reaches this, because absence in a draw carries no information.
export function retireEntry(doc, entryId, options = {}) {
  const entry = requireEntry(doc, entryId);
  entry.status = "retired";
  entry.retired_at = options.at || now();
  entry.retired_by = options.by || null;
  doc.version += 1;
  return entry;
}

// A later run surfaced this concern again. Recorded, not counted, so an entry
// absorbing many observations is visible to a reader.
export function recordObservation(doc, entryId, observation = {}) {
  const entry = requireEntry(doc, entryId);
  entry.observations.push({
    run: observation.run || null,
    statement: observation.statement || null,
    observed_at: observation.at || now(),
  });
  doc.version += 1;
  return entry;
}

// Replace an entry's wording while keeping the concern and the audit trail.
// The prior entry stays in the document, superseded rather than edited.
export function supersedeEntry(doc, entryId, replacement = {}) {
  const existing = requireEntry(doc, entryId);
  const next = proposeEntry(doc, {
    concern: replacement.concern || existing.concern,
    statement: replacement.statement || existing.statement,
    basis: replacement.basis || existing.basis,
    ruling: { proposed_by_run: replacement.proposed_by_run || null },
  });
  existing.superseded_at = now();
  existing.superseded_by = next.id;
  return { superseded: existing, replacement: next };
}

// Entries in force: accepted, not retired, not superseded. This is what the
// compile path reads once ADR 0017 step 4 lands.
export function activeEntries(doc) {
  return (doc.entries || []).filter(
    (e) => e.status === "active" && !e.superseded_at
  );
}

// Everything a person has ruled on, in either direction. The concern matcher
// at step 2 checks fresh output against this set, not against active alone,
// because a declined concern must not return as a new proposal.
export function ruledEntries(doc) {
  return (doc.entries || []).filter((e) => e.ruling.decision);
}

export function proposedEntries(doc) {
  return (doc.entries || []).filter((e) => e.status === "proposed");
}

function refusalsPathname(clientId) {
  return `brand-world-system/clients/${clientId}/refusals.json`;
}

export function createVercelBlobRefusalsStore(options = {}) {
  const token = options.token || process.env.BLOB_READ_WRITE_TOKEN;
  const clientId = options.clientId || "default";
  const credentials = token ? { token } : {};

  // Imported at call time rather than at module load so the document layer
  // above can be exercised without the storage dependency. See the header.
  async function blob() {
    return import("@vercel/blob");
  }

  // A missing document and an unreadable one are different facts and this
  // module keeps them apart. The claims store collapses both into an empty
  // document, which is safe there because nothing decides anything on the
  // strength of emptiness. Here it would not be: the bootstrap path seeds only
  // when a client has no protections, so a transient read failure reported as
  // "no protections" could seed over a slate a person had already ruled.
  // Absence returns empty; failure throws.
  async function readOrCreate() {
    const { get } = await blob();
    const result = await get(refusalsPathname(clientId), {
      access: "private",
      ...credentials,
      useCache: false,
    });
    if (!result) return emptyDocument();
    if (result.statusCode === 404) return emptyDocument();
    if (result.statusCode !== 200 || !result.stream) {
      throw new Error("The stored protections could not be read.");
    }
    return JSON.parse(await new Response(result.stream).text());
  }

  async function persist(doc) {
    const { put } = await blob();
    doc.updated_at = now();
    await put(refusalsPathname(clientId), JSON.stringify(doc), {
      access: "private",
      ...credentials,
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return doc;
  }

  async function mutate(fn) {
    const doc = await readOrCreate();
    const result = fn(doc);
    await persist(doc);
    return { document: doc, result };
  }

  return {
    async read() {
      return readOrCreate();
    },
    async propose(input) {
      return mutate((doc) => proposeEntry(doc, input));
    },

    // Bootstrap only. Writes an initial slate into a client that has none.
    // Refuses when any entry already exists, so this can never overwrite a
    // ruled protection, and refuses rather than merging, because a partial
    // slate arriving beside ruled entries is a state nobody designed.
    async seed(entries) {
      const doc = await readOrCreate();
      if (doc.entries.length) {
        throw new Error(
          `This client already has ${doc.entries.length} protections. Seeding is for a client that has none.`
        );
      }
      for (const entry of entries) {
        proposeEntry(doc, entry);
      }
      await persist(doc);
      return { document: doc, seeded: doc.entries.length };
    },
    async accept(entryId, opts) {
      return mutate((doc) => acceptEntry(doc, entryId, opts));
    },
    async decline(entryId, opts) {
      return mutate((doc) => declineEntry(doc, entryId, opts));
    },
    async retire(entryId, opts) {
      return mutate((doc) => retireEntry(doc, entryId, opts));
    },
    async observe(entryId, observation) {
      return mutate((doc) => recordObservation(doc, entryId, observation));
    },
    async supersede(entryId, replacement) {
      return mutate((doc) => supersedeEntry(doc, entryId, replacement));
    },
    activeEntries,
    ruledEntries,
    proposedEntries,
  };
}
