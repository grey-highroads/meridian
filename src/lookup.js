// Lookup into a map keyed by a value that arrived from outside the code.
//
// Every object literal in JavaScript inherits from Object.prototype, so a bare
// `map[key]` resolves `constructor`, `hasOwnProperty`, `toString`, `valueOf`,
// and `__proto__` to functions and objects that were never entries in the map.
// All of them are truthy, so they pass the `|| fallback` idiom that normally
// catches an unknown key, and they flow onward into whatever consumes the
// result. Nothing throws. The consumer reads a property that is not there,
// gets undefined, and behaves as though a valid entry had been found.
//
// Found 2026-08-19 in `resolveLook`, where the compile path took the
// "a look was selected" branch on a look object with no `line` and dropped the
// entire capture character block from the prompt without printing anything
// wrong. The four other externally keyed lookups in the tree were closed in the
// same class the following commit.
//
// The rule this encodes: any map keyed by a value that arrives from a request
// body, a stored record, or a user field is looked up through here, not
// through `map[key] || fallback`. A key that is not an own entry gets the
// fallback, which is what an unknown key was always supposed to get.
export function ownEntry(map, key, fallback = null) {
  if (!map || key === null || key === undefined) return fallback;
  const own = Object.prototype.hasOwnProperty.call(map, String(key));
  if (!own) return fallback;
  return map[String(key)] || fallback;
}
