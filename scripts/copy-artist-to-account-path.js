import { pathToFileURL } from "node:url";
import { createBlobBackend } from "../src/artist/store.js";

// One-time script. The demo account stops being a special case and moves to the
// same storage layout every other account uses. This is the first half of that
// move: copy, then prove the copy is identical. Nothing is deleted here and the
// old paths stay exactly where they are, so the running app keeps reading what
// it reads today. The fork in pathFor comes out in the next commit.
//
// Run it against live storage with the account id and the artist id:
//
//   node scripts/copy-artist-to-account-path.js dierks-bentley dierks-bentley
//
// Running it a second time copies the same bytes over the same bytes and
// reports the same result, so a repeat run is harmless.

const ROOT = "brand-world-system/clients";

// Both prefixes are written out here rather than taken from pathFor, because
// today pathFor's demo branch returns the old path for this account and cannot
// produce the target. The uniform shape below is the one pathFor already
// returns for every other account.
export function oldPrefix(artistId) {
  return `${ROOT}/${artistId}/artist/`;
}

export function uniformPrefix(accountId, artistId) {
  return `${ROOT}/${accountId}/artists/${artistId}/`;
}

// The trailing slash is the whole trap. The old directory ends `/artist/` and
// the new one starts `/artists/`, so listing `/artist` without the slash reaches
// both and the script would read its own output back and report a copy that
// never happened. Every listing here passes the slash.
export async function copyArtistToAccountPath(options = {}) {
  const { backend, accountId, artistId } = options;
  const log = options.log || console.log;
  if (!backend) throw new Error("A storage backend is required.");
  if (!accountId) throw new Error("An account id is required.");
  if (!artistId) throw new Error("An artist id is required.");

  const from = oldPrefix(artistId);
  const to = uniformPrefix(accountId, artistId);
  if (from === to) throw new Error("The old path and the uniform path are the same, so there is nothing to copy.");

  // The filter repeats what the prefix already asks for, so a backend that
  // widened the match cannot hand this script a path outside the old directory.
  const sources = (await backend.list(from)).filter((path) => path.startsWith(from)).sort();
  if (sources.length === 0) {
    log(`Nothing found under ${from}. No documents were copied.`);
    return { from, to, copied: [] };
  }

  const copied = [];
  for (const source of sources) {
    const name = source.slice(from.length);
    const target = `${to}${name}`;
    const body = await backend.read(source);
    if (body === null || body === undefined) throw new Error(`${source} listed but could not be read. Nothing after it was copied.`);

    await backend.write(target, body);

    // Both sides are read back from storage after the write. Comparing the
    // value that was passed in would prove the script's own variable, not the
    // bytes that landed.
    const sourceAfter = await backend.read(source);
    const targetAfter = await backend.read(target);
    const sourceBytes = Buffer.from(sourceAfter === null || sourceAfter === undefined ? "" : String(sourceAfter), "utf8");
    const targetBytes = Buffer.from(targetAfter === null || targetAfter === undefined ? "" : String(targetAfter), "utf8");
    const matched = targetAfter !== null && targetAfter !== undefined && sourceBytes.equals(targetBytes);

    log(`${source} to ${target}, ${sourceBytes.length} bytes, ${matched ? "matched" : "did not match"}`);
    copied.push({ source, target, bytes: sourceBytes.length, matched });

    if (!matched) throw new Error(`${target} does not hold the same bytes as ${source}. Nothing after it was copied.`);
  }

  log(`Copied ${copied.length} document${copied.length === 1 ? "" : "s"}. Every comparison matched.`);
  return { from, to, copied };
}

const invokedDirectly = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const [accountId, artistId] = process.argv.slice(2);
  try {
    if (!accountId || !artistId) throw new Error("Usage: node scripts/copy-artist-to-account-path.js <account-id> <artist-id>");
    await copyArtistToAccountPath({ backend: createBlobBackend(), accountId, artistId });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
