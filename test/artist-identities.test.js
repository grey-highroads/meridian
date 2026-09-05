import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_IDENTITIES, parseIdentities, parseIntake } from "../src/artist/parse-intake.js";
import { groupFindings } from "../src/artist/service.js";

// The identities an artist performs under used to be three constants in
// src/artist/parse-intake.js, taken from the first artist imported and offered
// to every artist after him, side project included. They come from the intake
// now. These tests hold that line: a second artist's import carries no trace of
// the first, and nothing in the app names an identity the record does not hold.

// A whole intake in miniature. Small enough to read, complete enough that the
// parser accepts it, and naming an artist who shares no identity with the first.
function secondArtistIntake() {
  return {
    prior: "Nothing was held before this run.",
    log: "One batch, read cold.",
    sources: [
      "# 01-sources.md",
      "",
      "Artist: Sona Vale",
      "",
      "Identity: SV is solo, DUO is Vale and Ruiz, SH is shared.",
      "",
      "## Tier 1: Official channels and releases",
      "",
      "| # | Source | URL | Facet | Era | Identity | Status |",
      "|---|---|---|---|---|---|---|",
      "| 1 | Sona Vale official site | https://sonavale.example/ | Visual language | Current | SV | Confirmed |",
      "| 2 | Vale and Ruiz tour page | https://valeruiz.example/ | Live history | Current | DUO | Confirmed |",
    ].join("\n"),
    claims: [
      "# 02-claims.md",
      "",
      "| # | Claim | Era | Facet | Identity | Source | Evidence |",
      "|---|---|---|---|---|---|---|",
      "| 1 | The solo show runs on one lamp. | Current | VL | SV | sonavale.example home | Home page, first fold. |",
      "| 2 | The duo plays seated. | Current | LH | DUO | valeruiz.example tour | Tour page. |",
    ].join("\n"),
    findings: [
      "# 03-findings.md",
      "",
      "## Counts per bin per facet",
      "",
      "| Facet | Confirmed | Corrected | New | Total |",
      "|---|---|---|---|---|",
      "| **All facets** | **0** | **0** | **2** | **2** |",
      "",
      "# Facet 3: Visual language",
      "",
      "## Solo",
      "",
      "**One lamp carries the solo show.** Every solo date is lit from a single source. 1 source, tier 1. **New.**",
      "",
      "# Facet 2: Live history",
      "",
      "## Vale and Ruiz",
      "",
      "**The duo plays seated.** Both players sit for the whole set. 1 source, tier 1. **New.**",
    ].join("\n"),
  };
}

test("the identity line in the sources file is what names an artist's identities", () => {
  const declared = parseIdentities("Identity: MS is main stage, HCK is Hot Country Knights, SH is shared.");
  assert.deepEqual(declared, [
    { code: "MS", id: "main-stage", name: "Main stage" },
    { code: "HCK", id: "hot-country-knights", name: "Hot Country Knights" },
    { code: "SH", id: "shared", name: "Shared" },
  ]);
});

test("an intake that names no identities gets the main stage and the shared bin", () => {
  assert.deepEqual(parseIdentities("# 01-sources.md\n\nNo identity line here.\n"), DEFAULT_IDENTITIES);
  // The default is a copy, so a caller that edits what it was handed cannot
  // change what the next import starts from.
  const first = parseIdentities("nothing");
  first[0].name = "Edited";
  assert.equal(parseIdentities("nothing")[0].name, "Main stage");
});

test("a second artist's import carries no trace of the first artist", () => {
  const parsed = parseIntake({ artistId: "sona-vale", artistName: "Sona Vale", ...secondArtistIntake() });

  assert.deepEqual(parsed.artist.identities, [
    { id: "solo", name: "Solo", code: "SV" },
    { id: "vale-and-ruiz", name: "Vale and Ruiz", code: "DUO" },
    { id: "shared", name: "Shared", code: "SH" },
  ]);

  // Every stored object, read for the first artist's identities by id and by
  // name. The side project is the one that would show first on a real import.
  const stored = JSON.stringify(parsed).toLowerCase();
  for (const trace of ["hot-country-knights", "hot country knights", "hck", "main-stage", "main stage"]) {
    assert.ok(!stored.includes(trace), `the second artist's import carries "${trace}"`);
  }

  // The codes in the tables and the headings in the findings file resolved
  // against this artist's own line rather than against a fixed list.
  assert.deepEqual(parsed.sources.map((source) => source.identity), ["solo", "vale-and-ruiz"]);
  assert.deepEqual(parsed.claims.map((claim) => claim.identities), [["solo"], ["vale-and-ruiz"]]);
  assert.deepEqual(parsed.findings.map((finding) => finding.identity), ["solo", "vale-and-ruiz"]);
});

test("a code this artist does not declare resolves to no identity", () => {
  const intake = secondArtistIntake();
  const withStranger = {
    ...intake,
    sources: intake.sources.replace(
      "| Visual language | Current | SV | Confirmed |",
      "| Visual language | Current | HCK | Confirmed |",
    ),
  };
  const parsed = parseIntake({ artistId: "sona-vale", artistName: "Sona Vale", ...withStranger });
  // Null rather than a guess. A code belonging to nobody on this artist's line
  // names nobody, and the row keeps everything else it carries.
  assert.equal(parsed.sources[0].identity, null);
  assert.equal(parsed.sources[0].title, "Sona Vale official site");
});

test("grouping reads the record's identities, so a second artist's findings are shown", () => {
  const findings = [
    { id: "finding-1", facet: "VL", identity: "solo", text: "One lamp." },
    { id: "finding-2", facet: "LH", identity: "vale-and-ruiz", text: "Seated." },
  ];
  const groups = groupFindings(findings, [
    { id: "solo", name: "Solo" },
    { id: "vale-and-ruiz", name: "Vale and Ruiz" },
  ]);
  assert.deepEqual(groups.map((group) => group.identity), ["vale-and-ruiz", "solo"]);
  assert.deepEqual(groups.map((group) => group.identityName), ["Vale and Ruiz", "Solo"]);
});

test("a finding whose identity the record does not name is shown rather than dropped", () => {
  // The failure this guards against is silent. Grouping over a fixed list
  // returned an empty page for an artist whose identities were not on it, and
  // nothing said a finding had gone missing.
  const findings = [{ id: "finding-1", facet: "VL", identity: "vale-and-ruiz", text: "Seated." }];
  const groups = groupFindings(findings, [{ id: "solo", name: "Solo" }]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].identity, "vale-and-ruiz");
  assert.deepEqual(groups[0].findings, findings);
  // The heading is read off the id, so it is a readable stand-in and not the
  // artist's own capitalisation. Only a record that failed to name the
  // identity reaches this, and the words are still a person's words.
  assert.equal(groups[0].identityName, "Vale and ruiz");

  // A record stored before identities came from the import carries none at all.
  const orphaned = groupFindings(findings, null);
  assert.equal(orphaned.length, 1);
  assert.equal(orphaned[0].identityName, "Vale and ruiz");
});
