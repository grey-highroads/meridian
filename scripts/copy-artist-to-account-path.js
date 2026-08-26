import { copyArtistToAccountPath } from "../src/artist/copy-to-account-path.js";
import { createBlobBackend } from "../src/artist/store.js";

// Command-line wrapper. The copy itself lives in src/artist/copy-to-account-path.js
// so the Admin action can import it without reaching into this folder.
//
//   node scripts/copy-artist-to-account-path.js dierks-bentley dierks-bentley

const [accountId, artistId] = process.argv.slice(2);
try {
  if (!accountId || !artistId) throw new Error("Usage: node scripts/copy-artist-to-account-path.js <account-id> <artist-id>");
  await copyArtistToAccountPath({ backend: createBlobBackend(), accountId, artistId });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
