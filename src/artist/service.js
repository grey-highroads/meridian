import { ownEntry } from "../lookup.js";
import { FACET_CODES, FACET_NAMES } from "./parse-intake.js";
import { applyRulings, brainApproved } from "./store.js";

// The brain is every finding the operator produced, minus the ones a person
// has taken out. Everything else in the record is the working material behind
// those findings.

// The identities a record was imported with, in the order the intake stated
// them. A finding carrying an identity the list does not name is still shown,
// under a heading read from its own id, because a grouping that only knows a
// fixed set of identities drops every finding belonging to any other artist.
function identitiesFor(identities, findings) {
  const scope = [];
  const seen = new Set();
  for (const entry of Array.isArray(identities) ? identities : []) {
    if (!entry || !entry.id || seen.has(entry.id)) continue;
    seen.add(entry.id);
    scope.push({ id: entry.id, name: entry.name || readableIdentity(entry.id) });
  }
  for (const finding of findings) {
    if (!finding.identity || seen.has(finding.identity)) continue;
    seen.add(finding.identity);
    scope.push({ id: finding.identity, name: readableIdentity(finding.identity) });
  }
  return scope;
}

function readableIdentity(id) {
  const words = String(id).split("-").filter(Boolean);
  if (!words.length) return String(id);
  return [words[0][0].toUpperCase() + words[0].slice(1), ...words.slice(1)].join(" ");
}

export function groupFindings(findings, identities) {
  const groups = [];
  for (const facet of FACET_CODES) {
    for (const identity of identitiesFor(identities, findings)) {
      const inGroup = findings.filter((finding) => finding.facet === facet && finding.identity === identity.id);
      if (!inGroup.length) continue;
      groups.push({
        facet,
        facetName: ownEntry(FACET_NAMES, facet, facet),
        identity: identity.id,
        identityName: identity.name,
        findings: inGroup,
      });
    }
  }
  return groups;
}

export function buildArtistView(record, decisions) {
  const findings = applyRulings(Array.isArray(record.findings) ? record.findings : [], decisions);
  const inBrain = findings.filter((finding) => finding.inBrain);
  return {
    artist: record.artist || null,
    approved: brainApproved(decisions),
    approvedBy: decisions?.brain?.approvedBy || null,
    approvedAt: decisions?.brain?.approvedAt || null,
    counts: {
      sources: (record.sources || []).length,
      claims: (record.claims || []).length,
      findings: findings.length,
      inBrain: inBrain.length,
      removed: findings.length - inBrain.length,
    },
    // get-artist is the brain, so it carries what is in it and nothing else.
    groups: groupFindings(inBrain, record.artist ? record.artist.identities : null),
  };
}

export function listFindings(record, decisions, { facet, identity } = {}) {
  let findings = applyRulings(Array.isArray(record.findings) ? record.findings : [], decisions);
  if (facet) findings = findings.filter((finding) => finding.facet === facet);
  if (identity) findings = findings.filter((finding) => finding.identity === identity);
  return groupFindings(findings, record.artist ? record.artist.identities : null);
}

export function evidenceFor(record, findingId) {
  const findings = Array.isArray(record.findings) ? record.findings : [];
  const finding = findings.find((entry) => entry.id === findingId);
  if (!finding) {
    const error = new Error("That finding was not found.");
    error.status = 404;
    throw error;
  }
  const claimIds = Array.isArray(finding.claimIds) ? finding.claimIds : [];
  const claims = (record.claims || []).filter((claim) => claimIds.includes(claim.id));
  const sourceIds = [...new Set(claims.map((claim) => claim.sourceId).filter(Boolean))];
  const sources = (record.sources || []).filter((source) => sourceIds.includes(source.id));
  return {
    findingId,
    independentSourceCount: finding.independentSourceCount,
    tiers: finding.tiers || [],
    evidenceLinked: finding.evidenceLinked === true,
    claims,
    sources,
  };
}
