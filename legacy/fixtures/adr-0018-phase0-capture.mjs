// ADR 0018 phase 0 harness: capture the compiled prompt baseline.
//
// Compiles each frozen fixture scene through the live compile path and records
// the full package, per section word counts, prohibition density, and the
// failure flags the phase 1 gate is registered against. Unlike the ADR 0016
// step 1 harness this imports the real compiler, so there is no hand copied
// function and no drift tripwire. The integrity requirement is attribution:
// every capture names the commit it ran against, and the harness refuses to
// run on a dirty tree because a baseline that cannot be pinned to a commit
// proves nothing.
//
// No model is called and no network is touched. This is compile only.
//
// Run from the repo root:
//   node fixtures/adr-0018-phase0-capture.mjs
//   node fixtures/adr-0018-phase0-capture.mjs --client mycopop
//   node fixtures/adr-0018-phase0-capture.mjs --scene mycopop-park-lifestyle
//
// Flags:
//   --scenes   path, default fixtures/adr-0018-phase0-scenes.json
//   --inputs   directory, default fixtures/adr-0018-phase0-inputs
//   --out      directory, default fixtures/adr-0018-phase0-captures
//   --client   filter to one client id
//   --scene    filter to one scene id
//   --allow-dirty   run on a dirty tree anyway; the capture is marked
//                   unattributable and must not be used as the baseline
//   --baseline      directory of an earlier capture set. Every section except
//                   Assignment must come back byte identical against it, which
//                   is how a scene writer test proves it changed only the scene
//                   rather than assuming it. Three couplings in the compile
//                   path key off scene text (a screen keyword regex that adds a
//                   protection rule, state neutralization, and screen
//                   orientation neutralization), so isolation is a claim that
//                   can fail and has to be checked rather than argued.
//   --briefs        JSON file of replacement briefs keyed by scene id, merged
//                   over the frozen scene brief. This is how new scene writer
//                   output is tested against frozen fixtures without editing
//                   the frozen scenes.
//
// Inputs it reads, all gitignored per ADR 0004:
//   fixtures/adr-0018-phase0-inputs/<client>-brain.json
//       The approved brain, either the raw brain object or
//       { approvedBrain, brainVersion }.
//   fixtures/adr-0018-phase0-inputs/<client>-refusals.json
//       Optional. The accepted protection entries as an array. When present
//       the compiler takes the governed channel, matching production.
//   fixtures/adr-0018-phase0-inputs/<client>-product-<productId>.json
//       Optional. The approved product record for scenes that name one.
//
// Output: one JSON capture per scene in the out directory, plus summary.md
// with the metrics table for the evaluations document.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { compileBrandWorldImagePackage } from "../src/production/package.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    scenes: join(REPO_ROOT, "fixtures/adr-0018-phase0-scenes.json"),
    inputs: join(REPO_ROOT, "fixtures/adr-0018-phase0-inputs"),
    out: join(REPO_ROOT, "fixtures/adr-0018-phase0-captures"),
    client: null,
    scene: null,
    allowDirty: false,
    baseline: null,
    briefs: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--allow-dirty") { args.allowDirty = true; continue; }
    const value = argv[i + 1];
    if (flag === "--scenes") { args.scenes = value; i += 1; }
    else if (flag === "--inputs") { args.inputs = value; i += 1; }
    else if (flag === "--out") { args.out = value; i += 1; }
    else if (flag === "--client") { args.client = value; i += 1; }
    else if (flag === "--scene") { args.scene = value; i += 1; }
    else if (flag === "--baseline") { args.baseline = value; i += 1; }
    else if (flag === "--briefs") { args.briefs = value; i += 1; }
    else throw new Error(`Unknown flag: ${flag}`);
  }
  return args;
}

// ---------------------------------------------------------------------------
// Attribution: which code produced this baseline
// ---------------------------------------------------------------------------

function attribution(allowDirty) {
  const commit = execSync("git rev-parse HEAD", { cwd: REPO_ROOT }).toString().trim();
  const dirty = execSync("git status --porcelain", { cwd: REPO_ROOT }).toString().trim();
  if (dirty && !allowDirty) {
    throw new Error(
      "The working tree is dirty. A baseline captured from uncommitted code cannot be attributed to a commit and proves nothing. Commit or stash, or pass --allow-dirty for a throwaway run."
    );
  }
  return { commit, attributable: !dirty, capturedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

function wordCount(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  return words.length;
}

function countMatches(text, pattern) {
  const matches = String(text || "").match(pattern);
  return matches ? matches.length : 0;
}

const PROHIBITION_PATTERNS = [
  { label: "do not", pattern: /\bdo not\b/gi },
  { label: "never", pattern: /\bnever\b/gi },
  { label: "avoid", pattern: /\bavoid\b/gi },
  { label: "no <thing>", pattern: /(?:^|[.:;] )no\s+[a-z]/gi },
];

// Section titles whose whole purpose is closing off wrong answers. Their word
// share is the number the audit put at 49 percent, tracked here per capture.
const PROHIBITION_SECTIONS = new Set(["What this brand is not", "Protection"]);

function measure(pkg, scene, lockedAsset) {
  const totalWords = wordCount(pkg.prompt);
  const sections = pkg.sections.map((section) => ({
    title: section.title,
    words: wordCount(section.body),
    share: totalWords ? Math.round((wordCount(section.body) / totalWords) * 1000) / 10 : 0,
  }));

  const prohibitions = {};
  let prohibitionTotal = 0;
  for (const { label, pattern } of PROHIBITION_PATTERNS) {
    const count = countMatches(pkg.prompt, pattern);
    prohibitions[label] = count;
    prohibitionTotal += count;
  }

  const prohibitionSectionWords = pkg.sections
    .filter((section) => PROHIBITION_SECTIONS.has(section.title))
    .reduce((sum, section) => sum + wordCount(section.body), 0);

  // Gate flag: a preservation instruction compiled with nothing to preserve.
  const impossibleInvariant =
    !lockedAsset && /preserve the supplied (package|template)/i.test(pkg.prompt);

  // Gate flag: inactive direction leakage. A marker counts as leakage when the
  // scene brief itself never asked for it but the compiled prompt carries it.
  const leakage = (scene.leakageMarkers || []).map((marker) => {
    const pattern = new RegExp(`\\b${marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const sceneText = [scene.brief.scene, scene.brief.sceneComposition, scene.brief.sceneLighting, scene.brief.sceneProps]
      .filter(Boolean)
      .join(" ");
    const inScene = countMatches(sceneText, pattern);
    const inPrompt = countMatches(pkg.prompt, pattern);
    return { marker, inScene, inPrompt, leaked: inScene === 0 && inPrompt > 0 };
  });

  return {
    totalWords,
    sections,
    prohibitions,
    prohibitionTotal,
    prohibitionSectionWords,
    prohibitionSectionShare: totalWords
      ? Math.round((prohibitionSectionWords / totalWords) * 1000) / 10
      : 0,
    photorealisticCount: countMatches(pkg.prompt, /photorealistic/gi),
    impossibleInvariant,
    leakage,
    leakedMarkers: leakage.filter((entry) => entry.leaked).map((entry) => entry.marker),
    look: pkg.look,
  };
}

// ---------------------------------------------------------------------------
// Isolation check
// ---------------------------------------------------------------------------

// A scene writer test changes the Assignment block and nothing else. That is a
// claim about the compiler, not a fact: three branches key off scene text, so
// new scene wording can move the protection block or have its own words
// rewritten underneath it. This compares every section against an earlier
// capture and reports any section other than Assignment that moved. A moved
// section is a recorded finding, and any attribution of a render difference to
// the scene writer alone is void for that fixture.
function compareToBaseline(baselineDir, sceneId, pkg) {
  if (!existsSync(baselineDir)) {
    throw new Error(`Baseline directory not found: ${baselineDir}`);
  }
  const match = readdirSync(baselineDir).filter((name) => name.endsWith(`-${sceneId}.json`)).sort();
  if (!match.length) return { compared: false, reason: `no baseline capture for ${sceneId}` };

  const baseline = JSON.parse(readFileSync(join(baselineDir, match[match.length - 1]), "utf8"));
  if (baseline.error || !baseline.package) return { compared: false, reason: "baseline capture holds no package" };

  const baseSections = new Map(baseline.package.sections.map((section) => [section.title, section.body]));
  const newSections = new Map(pkg.sections.map((section) => [section.title, section.body]));
  const titles = [...new Set([...baseSections.keys(), ...newSections.keys()])];

  const moved = [];
  for (const title of titles) {
    if (title === "Assignment") continue;
    const before = baseSections.get(title);
    const after = newSections.get(title);
    if (before === after) continue;
    moved.push({
      section: title,
      change: before === undefined ? "added" : after === undefined ? "removed" : "changed",
      baselineWords: before === undefined ? 0 : wordCount(before),
      newWords: after === undefined ? 0 : wordCount(after),
    });
  }
  // Section equality is not the whole isolation question. Two compile branches
  // rewrite the scene's own words before compiling them, so the Assignment can
  // hold text the scene writer did not write. Those edits land inside the one
  // section this check permits to change, which is exactly where they would go
  // unnoticed. Reported separately: a silent edit is a finding even when every
  // section outside Assignment held still.
  const rewrites = [
    ...(pkg.stateNeutralizations || []).map((entry) => ({ kind: "state", entry })),
    ...(pkg.orientationAdjustments || []).map((entry) => ({ kind: "orientation", entry })),
  ];

  return {
    compared: true,
    baselineFile: match[match.length - 1],
    baselineCommit: baseline.attribution?.commit || null,
    isolated: moved.length === 0,
    moved,
    sceneRewritten: rewrites.length > 0,
    rewrites,
  };
}

// ---------------------------------------------------------------------------
// Input loading
// ---------------------------------------------------------------------------

function readJson(path, label) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${label} at ${path}. See the header comment for the expected inputs.`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadBrain(inputsDir, clientId) {
  const raw = readJson(join(inputsDir, `${clientId}-brain.json`), `${clientId} brain`);
  if (raw.approvedBrain) return { approvedBrain: raw.approvedBrain, brainVersion: raw.brainVersion || 1 };
  return { approvedBrain: raw, brainVersion: raw.version || 1 };
}

function loadRefusals(inputsDir, clientId) {
  const path = join(inputsDir, `${clientId}-refusals.json`);
  if (!existsSync(path)) return null;
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const entries = Array.isArray(raw) ? raw : raw.entries || [];
  return entries.length ? entries : null;
}

function loadProduct(inputsDir, clientId, productId) {
  if (!productId) return null;
  return readJson(
    join(inputsDir, `${clientId}-product-${productId}.json`),
    `${clientId} product ${productId}`
  );
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv);
  const attributed = attribution(args.allowDirty);
  const scenesDoc = readJson(args.scenes, "scenes file");

  if (scenesDoc.status !== "frozen") {
    throw new Error(
      `The scenes file status is "${scenesDoc.status}". Captures only run against frozen scenes; a baseline against draft scenes would be re-litigated the moment a scene changes. Freeze the scenes first.`
    );
  }

  let scenes = scenesDoc.scenes;
  if (args.client) scenes = scenes.filter((scene) => scene.client === args.client);
  if (args.scene) scenes = scenes.filter((scene) => scene.id === args.scene);
  if (!scenes.length) throw new Error("No scenes matched the filters.");

  mkdirSync(args.out, { recursive: true });

  const briefOverrides = args.briefs ? readJson(args.briefs, "briefs file") : null;

  let isolationFailures = 0;
  const summaryRows = [];
  for (const scene of scenes) {
    const { approvedBrain, brainVersion } = loadBrain(args.inputs, scene.client);
    const refusals = loadRefusals(args.inputs, scene.client);
    const product = loadProduct(args.inputs, scene.client, scene.productId || null);

    // Mirror src/production/service.js#prepareProductionPackage: a product's
    // isolated image is promoted to the locked asset when nothing else is
    // locked. Without this the capture would compile the world-only protection
    // path while production compiles the preserve-exactly path, and the
    // baseline would measure the wrong prompt.
    let lockedAsset = null;
    const productImages = Array.isArray(product?.images) ? product.images : [];
    const isolated = productImages.find((image) => image.kind === "isolated" && image.blob_pathname);
    if (isolated) {
      lockedAsset = {
        source: { id: `product:${product.product_id}`, name: `${product.product_name} product image` },
        file: { name: isolated.file_name, type: isolated.content_type, blobPathname: isolated.blob_pathname },
        name: `${product.product_name} product image`,
        assetType: "product",
        fileName: isolated.file_name,
      };
    }

    let capture;
    try {
      const pkg = compileBrandWorldImagePackage({
        approvedBrain,
        brainVersion,
        brief: briefOverrides?.[scene.id] ? { ...scene.brief, ...briefOverrides[scene.id] } : scene.brief,
        references: [],
        lockedAsset,
        templateAsset: null,
        campaign: null,
        product,
        copyOutputs: [],
        claimsSet: null,
        displayCopy: null,
        refusals,
      });
      capture = {
        sceneId: scene.id,
        client: scene.client,
        attribution: attributed,
        refusalsChannel: refusals ? "governed" : "livedWorld",
        productId: scene.productId || null,
        lockedAssetChannel: lockedAsset ? "product isolated image" : "none",
        briefOverridden: Boolean(briefOverrides?.[scene.id]),
        isolation: args.baseline ? compareToBaseline(args.baseline, scene.id, pkg) : null,
        metrics: measure(pkg, scene, lockedAsset),
        package: pkg,
      };
    } catch (error) {
      capture = {
        sceneId: scene.id,
        client: scene.client,
        attribution: attributed,
        error: String(error && error.message ? error.message : error),
      };
    }

    const fileName = `${attributed.capturedAt.slice(0, 10)}-${scene.id}.json`;
    writeFileSync(join(args.out, fileName), JSON.stringify(capture, null, 2));

    if (capture.error) {
      summaryRows.push(`| ${scene.id} | COMPILE FAILED | | | | ${capture.error} |`);
      console.log(`${scene.id}: COMPILE FAILED: ${capture.error}`);
    } else {
      const m = capture.metrics;
      const iso = capture.isolation;
      const isoCell = !iso ? "not checked"
        : !iso.compared ? iso.reason
        : !iso.isolated ? `NOT ISOLATED: ${iso.moved.map((entry) => `${entry.section} ${entry.change}`).join(", ")}`
        : iso.sceneRewritten ? `isolated, but the compiler rewrote the scene text (${iso.rewrites.length} edit(s))`
        : "isolated";
      summaryRows.push(
        `| ${scene.id} | ${m.totalWords} | ${m.prohibitionSectionShare}% | ${m.prohibitionTotal} | ${m.impossibleInvariant ? "YES" : "no"} | ${m.leakedMarkers.join(", ") || "none"} | ${isoCell} |`
      );
      console.log(
        `${scene.id}: ${m.totalWords} words, prohibition sections ${m.prohibitionSectionShare}%, ${m.prohibitionTotal} prohibition phrases, impossible invariant ${m.impossibleInvariant ? "YES" : "no"}, leaked markers: ${m.leakedMarkers.join(", ") || "none"}, look ${m.look?.id || "none"}${iso ? `, isolation: ${isoCell}` : ""}`
      );
      if (iso && iso.compared && (!iso.isolated || iso.sceneRewritten)) isolationFailures += 1;
    }
  }

  const summary = [
    `# ADR 0018 phase 0 capture summary`,
    ``,
    `- Commit: ${attributed.commit}`,
    `- Attributable: ${attributed.attributable}`,
    `- Captured: ${attributed.capturedAt}`,
    ``,
    `| Scene | Total words | Prohibition section share | Prohibition phrases | Impossible invariant | Leaked markers | Isolation |`,
    `|---|---|---|---|---|---|---|`,
    ...summaryRows,
    ``,
  ].join("\n");
  writeFileSync(join(args.out, "summary.md"), summary);
  console.log(`\nWrote ${scenes.length} capture(s) and summary.md to ${args.out}`);
  if (isolationFailures) {
    console.log(
      `\nISOLATION FLAGGED on ${isolationFailures} scene(s): a section other than Assignment moved, or the compiler rewrote the scene writer's own words. Either way a render difference on those fixtures cannot be attributed to the scene writer alone. Record it as a finding before reading any render.`
    );
  }
}

main();
