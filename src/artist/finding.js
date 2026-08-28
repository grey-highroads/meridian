// The sentence a creative reader needs from an intake finding. The source
// count, tiers, and the intake comparison after them are stored separately.
// Runs created before that separation still carry the old tail, so every
// reader uses this same boundary without rewriting those stored snapshots.
export function findingStatement(text) {
  return String(text || "")
    .replace(/\*\*/g, "")
    .replace(/\s*\d+\s+sources?,\s+tiers?[^.]*\.[\s\S]*$/i, "")
    .trim();
}
