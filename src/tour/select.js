import { FACET_NAMES } from "../artist/parse-intake.js";
import { ownEntry } from "../lookup.js";

// Assemble context, do not dump it.
//
// The assembly here is scope, not scoring. A tour reads the identity it is for,
// so a main stage assignment sees the main stage findings and the shared ones
// and never the Hot Country Knights. That is a rule with a reason behind it and
// it can be checked.
//
// Which of those findings apply to one request is a judgment about meaning, and
// term overlap cannot make it. A first pass scored findings by shared words and
// put an unresolved question about a record label at the top of a request for a
// storm, while the aviation staging that the request is actually about sat near
// the bottom. Choosing the findings is left to the model, which is asked to say
// why it chose each one and to cite them by id so a person can check the pick.
//
// What the brand avoids travels whole and unscored, because the thesis says the
// brain flags it before a person has to.

export function scopeFindings(brain, identity) {
  const findings = (brain.groups || []).flatMap((group) => group.findings);
  const inScope = findings.filter((finding) => finding.identity === identity || finding.identity === "shared");
  return { all: findings, inScope };
}

function shape(finding) {
  return {
    findingId: finding.id,
    facet: finding.facet,
    facetName: ownEntry(FACET_NAMES, finding.facet, finding.facet),
    identity: finding.identity,
    text: finding.text,
    bin: finding.bin,
    independentSourceCount: finding.independentSourceCount,
    tiers: finding.tiers,
  };
}

export function assembleContext(brain, tour, assignment) {
  const identity = assignment.identity || "main-stage";
  const { all, inScope } = scopeFindings(brain, identity);
  const findings = inScope.map(shape);
  return {
    tourId: tour.id,
    assignmentId: assignment.id,
    directionVersion: tour.direction.version,
    identity,
    direction: tour.direction,
    request: assignment.request,
    counts: { inBrain: all.length, inScope: findings.length },
    findings,
    avoids: findings.filter((entry) => entry.facet === "AV"),
  };
}
