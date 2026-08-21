// Bootstrap slates for the two clients that have refusals authored ahead of
// the matcher. See ADR 0017 step 3.
//
// These entries are the hand-authored step 1 fixture documents, carried over
// with their derivations intact. They were authored from each brand's approved
// protections plus ten recorded runs of synthesis output, and they passed a
// judged gate, which is what makes them fit to propose. Every entry enters as
// a proposal regardless of whether the fixture had it active, because nobody
// has ruled on it in this surface and a slate that arrives pre-accepted would
// be the system ruling on a person's behalf.
//
// Seeding from a fixture is the bootstrap mechanism for these two clients and
// for no others. Every client after them receives proposals from synthesis
// through the matcher, which is ADR 0017 step 2. The canonical fixtures live
// at fixtures/adr-0017-refusals/ and this module is generated from them; a
// change to one checks the other.

const SLATES = {};

// Real client ids are not the slate keys. `clients/store.js#create` builds an
// id as `slugify(name)-shortId`, so a client named Example is stored as
// example followed by a hyphen and its own suffix. Matching on the
// slug plus a hyphen is therefore a match against the documented way ids are
// made rather than a guess about their shape, and reading the client index to
// resolve by name would add a blob call and a dependency on that index being
// current to learn something the id already states.
//
// The hyphen boundary is load bearing: without it example would also match a
// later client named Example2. An exact match is accepted too, so fixtures and
// local runs that use the bare key still resolve.
//
// One function serves both the availability check and the seed itself. If the
// two resolved differently the interface could offer a button that fails when
// pressed, which is a worse failure than no button.
export function resolveBootstrapSlate(clientId) {
  const id = String(clientId || "");
  for (const key of Object.keys(SLATES)) {
    if (id === key || id.startsWith(`${key}-`)) {
      return { key, entries: SLATES[key] };
    }
  }
  return null;
}

export function bootstrapClientIds() {
  return Object.keys(SLATES);
}
