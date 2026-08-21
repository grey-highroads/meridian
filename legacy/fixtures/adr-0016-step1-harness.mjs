// ADR 0016 step 1 harness: visual grammar fixtures against the scene writer.
//
// TEMPORARY. This is prototype tooling for ADR 0016 step 1, not product code.
// It duplicates the scene writer's context assembly rather than importing it,
// because handleSceneBrief is not exported: it lives inline in
// api/production/generate-copy.js under the 12 function ceiling. Extraction
// into src/ is deferred to ADR 0016 step 4, which rewrites that assembly
// anyway. Delete this file when step 4 lands.
//
// Because the duplication is a drift risk, the harness refuses to run when the
// live function no longer matches what it was built against. See TRIPWIRE.
//
// Run from the repo root:
//   OPENAI_API_KEY=sk-... GITHUB_TOKEN=ghp_... \
//     node fixtures/adr-0016-step1-harness.mjs --client mycopop --mode baseline --sets 3
//
// Flags:
//   --client   mycopop | dialog-health   (selects the brain and grammar files)
//   --mode     baseline | grammar        (grammar swaps the fixture in place of
//                                         the IDENTITY and CREATIVE lines)
//   --sets     integer, default 3        (consecutive suggestion sets)
//   --out      directory, default fixtures/adr-0016-step1-captures
//   --dry-run                            (assemble and print the prompts, then
//                                         stop before the model call. Use it to
//                                         confirm file placement and the
//                                         assembled context without spending a
//                                         call. Still runs the tripwire.)
//
// Inputs it reads:
//   fixtures/adr-0016-step1-brains/<client>.json     the pasted approved brain
//   fixtures/adr-0016-step1-grammar/<client>.json    the hand authored grammar
//
// Output: one JSON file per run holding every set verbatim, plus the assembled
// system and user prompts, the tripwire hash, and the run metadata.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { createHash } from "crypto";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");

// ---------------------------------------------------------------------------
// TRIPWIRE
// ---------------------------------------------------------------------------
// The assembly below is a hand copy of handleSceneBrief as it stands at the
// commit named here. Before any model call, the harness pulls that function
// from main through the Git Data API, hashes it, and compares. A mismatch
// halts the run. It does not warn and continue: a harness that quietly tests
// something other than the live path produces evidence about nothing.
//
// The Git Data API is used rather than the contents raw endpoint because the
// raw endpoint serves cached content and can report a stale match.

const TRIPWIRE = {
  repo: "grey-highroads/brand-world-system",
  path: "api/production/generate-copy.js",
  ref: "heads/main",
  functionStart:
    "async function handleSceneBrief({ body, brain, product, apiKey, response }) {",
  builtAgainstCommit: "5cb49281f549a6fdf38ca5b980ef224741b582cc",
  expectedSha256:
    "db81c0e89e42b24647266c52ece9d8442e1d9c0b241e5924fe86d88a61c5c44d",
};

function extractFunction(source, startMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) {
    throw new Error(
      "Tripwire: the scene writer function signature was not found in the live file. The function was renamed or its signature changed. Stop and re-verify the harness against the live path."
    );
  }
  const end = source.indexOf("\n}\n", start);
  if (end === -1) {
    throw new Error(
      "Tripwire: the scene writer function has no terminating brace at column zero. The file structure changed. Stop and re-verify."
    );
  }
  return source.slice(start, end + 3);
}

async function checkTripwire() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "Tripwire: GITHUB_TOKEN is not set. The harness cannot verify itself against the live path and will not run."
    );
  }
  const gh = async (url) => {
    const res = await fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) {
      throw new Error(`Tripwire: GitHub returned ${res.status} for ${url}`);
    }
    return res.json();
  };
  const base = `https://api.github.com/repos/${TRIPWIRE.repo}`;

  const ref = await gh(`${base}/git/refs/${TRIPWIRE.ref}`);
  const headSha = ref.object.sha;
  const commit = await gh(`${base}/git/commits/${headSha}`);
  const tree = await gh(`${base}/git/trees/${commit.tree.sha}?recursive=1`);
  const entry = tree.tree.find((e) => e.path === TRIPWIRE.path);
  if (!entry) {
    throw new Error(
      `Tripwire: ${TRIPWIRE.path} is no longer in the tree at main. Stop and re-verify.`
    );
  }
  const blob = await gh(`${base}/git/blobs/${entry.sha}`);
  const source = Buffer.from(blob.content, "base64").toString("utf-8");

  const live = extractFunction(source, TRIPWIRE.functionStart);
  const liveSha = createHash("sha256").update(live, "utf-8").digest("hex");

  if (liveSha !== TRIPWIRE.expectedSha256) {
    throw new Error(
      [
        "Tripwire halt. The live scene writer no longer matches what this harness duplicates.",
        `  built against commit: ${TRIPWIRE.builtAgainstCommit}`,
        `  main is now at:       ${headSha}`,
        `  expected sha256:      ${TRIPWIRE.expectedSha256}`,
        `  live sha256:          ${liveSha}`,
        "",
        "The harness will not run. Any sets it produced would be evidence about a path that no longer exists. Re-copy the assembly, re-pin the hash, and re-baseline before capturing anything further.",
      ].join("\n")
    );
  }

  return { headSha, liveSha, drifted: headSha !== TRIPWIRE.builtAgainstCommit };
}

// ---------------------------------------------------------------------------
// DUPLICATED ASSEMBLY
// ---------------------------------------------------------------------------
// Below is api/production/generate-copy.js#handleSceneBrief, lines 324 to 469
// at the pinned commit, with three changes and no others:
//   1. It returns the parsed result instead of calling sendJson.
//   2. It returns the assembled prompts alongside the options, so captures
//      record what was actually sent.
//   3. In grammar mode it replaces the IDENTITY and CREATIVE DIRECTION context
//      lines with the grammar lines, per ADR 0016 step 1.
// Nothing else is edited. Keep it that way: the tripwire above only proves the
// live side is unchanged, it cannot prove this copy is faithful.

function grammarContextLines(grammar) {
  const section = (key, label) => {
    const entries = Array.isArray(grammar?.sections?.[key]) ? grammar.sections[key] : [];
    if (!entries.length) return null;
    // The ambition label travels into the prompt because ADR 0016 requires the
    // label to reach the compiled prompt and the result screen, not stop at the
    // brain interface. Origin never dampens the direction: an ambition entry
    // compiles at full strength.
    const body = entries
      .map((e) =>
        e.basis?.origin === "ambition"
          ? `${e.statement} (declared ambition for this brand)`
          : e.statement
      )
      .join(" ");
    return `${label}: ${body}`;
  };
  return [
    section("people", "PEOPLE ON CAMERA"),
    section("objects", "OBJECTS AND ERA"),
    section("places", "PLACES AND MATERIALS"),
    section("light", "LIGHT"),
    section("camera", "CAMERA"),
    section("rejects", "VISUAL TERRITORY THE BRAND REFUSES"),
  ].filter(Boolean);
}

function assembleSceneBrief({ body, brain, product, grammar, mode }) {
  const dossier = brain.artifacts?.dossier || {};
  const lived = brain.artifacts?.livedWorld || brain.artifacts?.lived_world || {};
  const section = (id) => brain.guidanceSections?.find((s) => s.id === id);
  const world = section("world");
  const identity = section("identity");
  const creative = section("creative");
  const rules = section("rules");
  const campaign = body.campaign || null;

  const drewOn = [];
  const context = [];

  context.push(`BRAND: ${brain.brandName}. ${brain.brandDescription || ""}`);
  if (world) {
    context.push(`WORLD: ${world.summary}. ${(world.principles || []).join(". ")}`);
    drewOn.push("Brand world guidance");
  }

  // ADR 0016 step 1 swap point. Baseline keeps identity and creative as the
  // live path sends them. Grammar mode sends the fixture in their place.
  if (mode === "grammar") {
    for (const line of grammarContextLines(grammar)) context.push(line);
    drewOn.push("Visual grammar (prototype fixture)");
  } else {
    if (identity) {
      context.push(`IDENTITY: ${identity.summary}. ${(identity.principles || []).join(". ")}`);
      drewOn.push("Identity guidance");
    }
    if (creative) {
      context.push(`CREATIVE DIRECTION: ${creative.summary}. ${(creative.principles || []).join(". ")}`);
      drewOn.push("Creative direction");
    }
  }

  const environments = Array.isArray(lived.environments) ? lived.environments : [];
  if (environments.length) {
    context.push(`EARNED ENVIRONMENTS: ${environments.map((e) => `${e.name || e.title || ""}${e.earned ? ` (why the brand belongs: ${e.earned})` : ""}`).filter(Boolean).join("; ")}`);
    drewOn.push("Lived World environments");
  }
  if (lived.person) {
    context.push(`PERSON AT THE CENTER: ${typeof lived.person === "string" ? lived.person : JSON.stringify(lived.person).slice(0, 600)}`);
    drewOn.push("Lived World person");
  }
  if (dossier.desiredFeeling) context.push(`DESIRED FEELING: ${dossier.desiredFeeling}`);
  if (dossier.materials?.length) context.push(`MATERIALS AND LIGHT: ${dossier.materials.join(", ")}`);
  if (dossier.palette?.length) context.push(`PALETTE: ${dossier.palette.map((c) => `${c.name} (${c.role})`).join(", ")}`);
  if (rules) {
    context.push(`RULES AND GUARDRAILS: ${rules.summary}. ${(dossier.guardrails || []).map((g) => `${g.title}: ${g.body}`).join(" ")}`);
    drewOn.push("Creative rules and guardrails");
  }
  if (campaign) {
    context.push(`CAMPAIGN: ${campaign.name}. Idea: ${campaign.campaignIdea || ""}. Message territory: ${campaign.messageTerritory || ""}. Audience: ${campaign.audience || ""}. Objective: ${campaign.objective || ""}`);
    drewOn.push(`Campaign: ${campaign.name}`);
  }
  if (product) {
    context.push(`PRODUCT: ${product.product_name}. ${product.one_true_thing || ""} Visual direction: ${product.visual_direction || ""}`);
    if (product.exclusions?.length) context.push(`PRODUCT EXCLUSIONS: ${product.exclusions.join("; ")}`);
    drewOn.push(`Product record: ${product.product_name}`);
    const images = Array.isArray(product.images) ? product.images : [];
    if (images.some((i) => i.kind === "isolated")) drewOn.push("Product image on the record");
  }

  const kinds = {
    scene: {
      task: "You art direct brand image production. For each direction you write four separate fields: the world, the composition, the lighting, and the props. This is direction for a photographer on set, not marketing copy. Write it the way a director of photography would be briefed.",
      rules: [
        "Describe only what a camera could see. No slogans, no statistics, no claims about the product's performance.",
        "Stay inside the brand's earned environments and guardrails. Do not invent a setting the brand has no reason to be in.",
        "The world field carries the place, the person, the moment, and what is happening. Name the hour and the specific physical evidence that the place is used by real people.",
        "The composition field carries camera behavior and spatial structure: where the subject sits in frame, camera height, focal length, depth of field, what runs from foreground to background, what is cropped by which frame edge, and an explicit ranking of what the eye should hit first, second, and third.",
        "In that ranking the person and what they are doing come first and the place they are in comes second. The product is not the first thing the eye lands on and it is not centered on a surface facing the camera. It sits where someone actually set it down or is holding it, inside the moment rather than on top of it.",
        "The product appears once. One unit, in one place, held or set down. Do not populate the scene with several of them.",
        "Compose off center. Give the frame an unbalanced weight, crop something at an edge, and let the camera read as an observation of a moment already happening rather than a setup arranged for it.",
        "The lighting field carries light behavior: the dominant source and its direction and color, any secondary source, how the two interact, contrast level, and where shadows fall.",
        "The props field is a short list of specific objects present in the scene. Objects with wear and use, not category defaults.",
        "The three directions must differ in world, not merely in wording.",
        "The brand's creative direction and declared ambitions are direction to follow, not background reading. If the brand has named an aesthetic it is reaching for, one of the three directions should pursue it.",
      ],
    },
  };
  const kind = kinds[String(body.kind || "scene")] || kinds.scene;

  const systemPrompt = [
    kind.task,
    "",
    context.join("\n"),
    "",
    "RULES:",
    ...kind.rules.map((rule) => `- ${rule}`),
    "- No em dashes. No fragment stacks. Plain declarative sentences.",
    String(body.kind || "scene") === "scene"
      ? "- Two to four sentences per field. Concrete nouns over adjectives. Specific over evocative."
      : "- Two or three sentences per brief. Concrete nouns over adjectives.",
    "",
    "OUTPUT FORMAT:",
    String(body.kind || "scene") === "scene"
      ? 'Return only JSON: {"options":[{"label":"three or four words","brief":"the world","composition":"the composition","lighting":"the lighting","props":"comma separated objects"}]} with exactly three options. No markdown fences, no preamble.'
      : 'Return only JSON: {"options":[{"label":"three or four words","brief":"the description"}]} with exactly three options. No markdown fences, no preamble.',
  ].join("\n");

  const userPrompt = [
    body.placementLabel ? `The output is a ${body.placementLabel}${body.placementRatio ? ` at ${body.placementRatio}` : ""}.` : "",
    body.placementCraft ? `Composition for this shape: ${body.placementCraft}` : "",
    body.hint ? `The user has started describing it: ${body.hint}` : "Propose three directions the brand could credibly take.",
  ].filter(Boolean).join("\n");

  return { systemPrompt, userPrompt, drewOn, body };
}

async function runSceneBrief({ body, brain, product, apiKey, grammar, mode }) {
  const { systemPrompt, userPrompt, drewOn } = assembleSceneBrief({ body, brain, product, grammar, mode });

  const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: String(body.kind || "scene") === "scene" ? 2200 : 800,
      temperature: 0.9,
    }),
  });
  if (!chatResponse.ok) {
    const errorBody = await chatResponse.text();
    throw new Error(`OpenAI returned status ${chatResponse.status}: ${errorBody.slice(0, 200)}`);
  }
  const chatData = await chatResponse.json();
  const raw = chatData.choices?.[0]?.message?.content?.trim() || "";
  let options = [];
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    options = Array.isArray(parsed.options) ? parsed.options.slice(0, 3) : [];
  } catch {
    throw new Error("The suggestions came back in an unexpected shape. Try again.");
  }
  if (!options.length) throw new Error("No suggestions came back. Try again.");

  return { options, drewOn, model: "gpt-4o", systemPrompt, userPrompt, rawResponse: raw };
}

// ---------------------------------------------------------------------------
// RUNNER
// ---------------------------------------------------------------------------

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const client = arg("client", "");
const mode = arg("mode", "baseline");
const sets = Number(arg("sets", "3"));
const outDir = arg("out", join(REPO_ROOT, "fixtures/adr-0016-step1-captures"));

if (!["mycopop", "dialog-health"].includes(client)) {
  console.error("Set --client to mycopop or dialog-health.");
  process.exit(1);
}
if (!["baseline", "grammar"].includes(mode)) {
  console.error("Set --mode to baseline or grammar.");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey && !dryRun) {
  console.error("Set OPENAI_API_KEY before running, or pass --dry-run to assemble without calling the model.");
  process.exit(1);
}

const brainPath = join(REPO_ROOT, `fixtures/adr-0016-step1-brains/${client}.json`);
const grammarPath = join(REPO_ROOT, `fixtures/adr-0016-step1-grammar/${client}.json`);

if (!existsSync(brainPath)) {
  console.error(`No brain at ${brainPath}. Place the approved brain payload there first.`);
  process.exit(1);
}
const brain = JSON.parse(readFileSync(brainPath, "utf-8"));
const grammar = mode === "grammar" ? JSON.parse(readFileSync(grammarPath, "utf-8")) : null;

// One approved product record per client, held constant across all six of that
// client's sets. Without it the harness would test a thinner context than real
// jobs use, because the live path pushes PRODUCT and PRODUCT EXCLUSIONS lines.
const productPath = join(REPO_ROOT, `fixtures/adr-0016-step1-products/${client}.json`);
if (!existsSync(productPath)) {
  console.error(
    [
      `No product record at ${productPath}.`,
      "Export the approved product record for this client and place it there.",
      "It needs product_name, one_true_thing, visual_direction, exclusions, and images.",
      "The harness will not run without it, because baseline and grammar sets must",
      "hold the product constant for the comparison to mean anything.",
    ].join("\n")
  );
  process.exit(1);
}
const product = JSON.parse(readFileSync(productPath, "utf-8"));
if (!product.approved_at) {
  console.error("The product record carries no approved_at. The live path rejects unapproved records with a 409, so the harness does too.");
  process.exit(1);
}

// The placement is held constant across every set so the only variable between
// baseline and grammar is the swapped context. Changing it invalidates the
// comparison.
const body = {
  kind: "scene",
  placementLabel: "social post",
  placementRatio: "1:1",
  placementCraft:
    "Square crop. Keep the subject off center and leave one quiet quadrant so the frame reads at thumbnail size.",
};

const run = async () => {
  console.log("Checking the tripwire before any model call.");
  const tw = await checkTripwire();
  console.log(`  live scene writer matches the pinned hash: ${tw.liveSha.slice(0, 12)}`);
  if (tw.drifted) {
    console.log(
      `  note: main has moved to ${tw.headSha.slice(0, 12)} since the harness was pinned, but the scene writer itself is unchanged.`
    );
  }

  if (dryRun) {
    const { systemPrompt, userPrompt, drewOn } = assembleSceneBrief({ body, brain, product, grammar, mode });
    console.log(`\nDry run. ${client} / ${mode}. Product: ${product.product_name}.`);
    console.log(`Product images on record: ${(Array.isArray(product.images) ? product.images : []).length}`);
    console.log(`drewOn: ${drewOn.join(" | ")}`);
    console.log(`\n--- SYSTEM PROMPT (${systemPrompt.length} chars) ---\n${systemPrompt}`);
    console.log(`\n--- USER PROMPT ---\n${userPrompt}`);
    console.log("\nNo model call was made.");
    return;
  }

  const capture = {
    harness: "fixtures/adr-0016-step1-harness.mjs",
    adr: "0016 step 1",
    client,
    mode,
    capturedAt: new Date().toISOString(),
    tripwire: {
      builtAgainstCommit: TRIPWIRE.builtAgainstCommit,
      liveHeadAtCapture: tw.headSha,
      sceneWriterSha256: tw.liveSha,
    },
    requestBody: body,
    product: { name: product.product_name, approvedAt: product.approved_at },
    grammarFixture: mode === "grammar" ? { client: grammar.client, authoredFrom: grammar.authoredFrom } : null,
    sets: [],
  };

  for (let i = 1; i <= sets; i += 1) {
    console.log(`Set ${i} of ${sets}...`);
    const result = await runSceneBrief({ body, brain, product, apiKey, grammar, mode });
    capture.sets.push({ set: i, ...result });
  }

  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${client}-${mode}.json`);
  writeFileSync(file, JSON.stringify(capture, null, 2));
  console.log(`Wrote ${sets} sets to ${file}`);
};

run().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
