import { selectApprovedBaseline } from "../brand-brain/service.js";
import { createVercelBlobProductStore } from "../products/store.js";
import { OPENAI_IMAGE_MODEL, chooseOpenAIImageEndpoint, renderWithOpenAIImages } from "../renderers/openai-images.js";
import { assembleClaimsSet } from "../claims/assembly.js";
import { produceCopy } from "../copy/generate.js";
import { displayBudgets, designFor } from "../copy/display-budget.js";
import { buildJobScope } from "../scope/resolver.js";
import { compileBrandWorldImagePackage } from "./package.js";

const rasterTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const allowedRoles = new Set(["Lighting + mood", "Composition", "Materials", "Casting", "Style calibration", "Differentiate away"]);
const allowedInfluence = new Set(["Lead", "Strong", "Supporting", "Light"]);

function safeId(value, label) {
  const id = String(value || "");
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{7,100}$/.test(id)) {
    const error = new Error(`${label} is invalid.`);
    error.status = 400;
    throw error;
  }
  return id;
}

function approvedContext(stored) {
  const approvedBrain = selectApprovedBaseline(stored);
  if (!approvedBrain) {
    const error = new Error("Approve a Brand Brain before generating production work.");
    error.status = 409;
    throw error;
  }
  return {
    approvedBrain,
    brainVersion: stored?.brain?.approvedVersion || stored?.brain?.artifactVersion || stored?.baselineVersion || 1,
  };
}

function resolveReferences(stored, requested = []) {
  if (!Array.isArray(requested) || requested.length > 8) {
    const error = new Error("Choose no more than eight creative source images.");
    error.status = 400;
    throw error;
  }
  const sourceById = new Map((stored?.sources || []).map((source) => [source.id, source]));
  return requested.map((selection) => {
    const source = sourceById.get(selection.id);
    if (!source || source.authority === "exact-asset" || source.authority === "approved-guidance") {
      const error = new Error("One selected creative source is not available for this production job.");
      error.status = 400;
      throw error;
    }
    const file = (source.files || []).find((candidate) => rasterTypes.has(String(candidate.type || "").toLowerCase()) && candidate.blobPathname);
    if (!file) {
      const error = new Error(`${source.name || "A selected source"} does not contain a usable PNG, JPG, or WEBP image.`);
      error.status = 400;
      throw error;
    }
    return {
      source,
      file,
      role: allowedRoles.has(selection.role) ? selection.role : "Style calibration",
      influence: allowedInfluence.has(selection.influence) ? selection.influence : "Supporting",
      usageInstruction: String(selection.usageInstruction || source.usage || "").slice(0, 1000),
    };
  });
}

/**
 * Resolve a locked asset from stored sources. The user selects which
 * exact-asset source to lock for this job by ID. The source must have
 * authority "exact-asset" and contain a raster file stored in Blob.
 *
 * Returns null when no locked asset is requested (world-only image).
 */
function resolveLockedAsset(stored, lockedAssetId) {
  if (!lockedAssetId) return null;
  const sourceById = new Map((stored?.sources || []).map((source) => [source.id, source]));
  const source = sourceById.get(lockedAssetId);
  if (!source) {
    const error = new Error("The selected protected asset was not found.");
    error.status = 400;
    throw error;
  }
  if (source.authority !== "exact-asset") {
    const error = new Error("Only a protected brand asset can be locked for production.");
    error.status = 400;
    throw error;
  }
  const file = (source.files || []).find((candidate) => rasterTypes.has(String(candidate.type || "").toLowerCase()) && candidate.blobPathname);
  if (!file) {
    const error = new Error(`${source.name || "The selected asset"} does not contain a usable PNG, JPG, or WEBP image. Upload a raster version of the asset.`);
    error.status = 400;
    throw error;
  }
  return {
    source,
    file,
    name: source.name || "Protected asset",
    assetType: source.declaredType || source.detail || "packaging",
    fileName: file.name,
  };
}

/**
 * Resolve a template asset for composition. Templates are exact-asset sources
 * tagged with templateMeta. The generated element is placed onto it. Returns
 * null when no template is selected.
 */
function resolveTemplateAsset(stored, templateAssetId) {
  if (!templateAssetId) return null;
  const sourceById = new Map((stored?.sources || []).map((source) => [source.id, source]));
  const source = sourceById.get(templateAssetId);
  if (!source) {
    const error = new Error("The selected template was not found.");
    error.status = 400;
    throw error;
  }
  if (!source.templateMeta?.isTemplate) {
    const error = new Error("The selected source is not a template.");
    error.status = 400;
    throw error;
  }
  const file = (source.files || []).find((candidate) => rasterTypes.has(String(candidate.type || "").toLowerCase()) && candidate.blobPathname);
  if (!file) {
    const error = new Error(`${source.name || "The selected template"} does not contain a usable image.`);
    error.status = 400;
    throw error;
  }
  return {
    source,
    file,
    name: source.name || "Background template",
    ratio: source.templateMeta.ratio || "",
    fileName: file.name,
  };
}

/**
 * Resolve a product record by id from the product store. Returns null when
 * no product is requested. The product record's claims, features, exclusions,
 * and visual direction feed into the compiled prompt (ADR 0012 step 4).
 */
async function resolveProduct(productStore, productId) {
  if (!productId) return null;
  const record = await productStore.readProduct(productId);
  if (!record) {
    const error = new Error(`The selected product "${productId}" was not found. Synthesize the product record first.`);
    error.status = 400;
    throw error;
  }
  // Only approved product records may be consumed by production. A candidate
  // is a synthesized record waiting for human review. This matches the
  // approval discipline the brain already uses.
  if (!record.approved_at) {
    const error = new Error(`The product record "${record.product_name}" is a candidate and has not been approved. Review and approve it before producing work from it.`);
    error.status = 409;
    throw error;
  }
  return record;
}

export async function prepareProductionPackage(body, options) {
  const stored = await options.brainStore.read();
  const { approvedBrain, brainVersion } = approvedContext(stored);
  const references = resolveReferences(stored, body.references || []);
  let lockedAsset = resolveLockedAsset(stored, body.lockedAssetId);
  const templateAsset = resolveTemplateAsset(stored, body.templateAssetId);
  // Resolve the product record when the request names one (ADR 0012 step 4).
  // The product store is passed in by the endpoint or constructed here from
  // the client id when available.
  const productStore = options.productStore || null;
  const product = productStore ? await resolveProduct(productStore, body.productId || null) : null;

  // Product imagery. An isolated image is the product itself and becomes the
  // protected subject when the job has not already locked something else. An
  // in-context image shows the product in use and joins the creative
  // references, where it informs the scene without being reproduced.
  const productImages = Array.isArray(product?.images) ? product.images : [];
  if (!lockedAsset) {
    const isolated = productImages.find((image) => image.kind === "isolated" && image.blob_pathname);
    if (isolated) {
      lockedAsset = {
        source: { id: `product:${product.product_id}`, name: `${product.product_name} product image` },
        file: {
          name: isolated.file_name,
          type: isolated.content_type,
          blobPathname: isolated.blob_pathname,
        },
        name: `${product.product_name} product image`,
        assetType: "product",
        fileName: isolated.file_name,
      };
    }
  }
  for (const image of productImages) {
    if (image.kind !== "in_context" || !image.blob_pathname) continue;
    if (references.length >= 8) break;
    references.push({
      source: { id: `product:${product.product_id}:${image.image_id}`, name: `${product.product_name} in use` },
      file: { name: image.file_name, type: image.content_type, blobPathname: image.blob_pathname },
      role: "Style calibration",
      influence: "Supporting",
      usageInstruction: image.caption
        ? `Shows how ${product.product_name} appears in real use: ${image.caption}. Match the placement, scale, and handling, not the specific scene.`
        : `Shows how ${product.product_name} appears in real use. Match the placement, scale, and handling, not the specific scene.`,
    });
  }

  // Copy outputs (ADR 0014 step 2). The claims set is assembled once and
  // reused: it steers generation and it is recorded in the package as the
  // governing set. A job that declares no copy output does no claims work and
  // compiles exactly as it did before this existed.
  // ADR 0017 step 4. Read once, per client, and hand the compiler the accepted
  // entries only. Proposed entries have not been ruled and declined ones were
  // ruled against, so neither reaches a prompt. A client with no protections
  // store injected, or none accepted, compiles from livedWorld.rejects exactly
  // as before.
  let refusals = null;
  if (options.refusalsStore) {
    const refusalsDocument = await options.refusalsStore.read();
    const active = options.refusalsStore.activeEntries(refusalsDocument);
    if (active.length) refusals = active;
  }

  const copyOutputs = resolveCopyOutputs(body.copyOutputs);
  let claimsSet = null;
  if (copyOutputs.length > 0 && options.claimsStore) {
    const claimsDocument = await options.claimsStore.read();
    claimsSet = assembleClaimsSet({
      claimsDocument,
      product,
      activeEntries: options.claimsStore.activeEntries,
      jobScope: buildJobScope({
        placement: body.brief?.placement,
        productId: body.productId,
        campaignId: body.campaign?.id,
        segment: body.segment,
      }),
    });
  }

  // Text in the image inverts the normal order. Copy is produced after the
  // render everywhere else, deliberately, so a copy failure never costs an
  // image that already succeeded. A string that has to be rendered has to
  // exist first, so it is produced here, before the compile.
  //
  // The failure is handled rather than propagated: if the copy cannot be
  // written, the job renders without it and says so. A blocked image is a
  // worse outcome than an image missing its headline, and the user can add
  // the copy in a layout tool either way.
  let displayCopy = null;
  let displayCopyBlock = null;
  let displayCopyError = null;
  if (body.renderCopyIntoImage && copyOutputs.includes("headline_set") && options.env?.OPENAI_API_KEY) {
    const zoneId = body.displayZone || "lower_third";
    const format = body.brief?.format || "";
    try {
      // Copy drafted and possibly edited in setup arrives with the job. It is
      // used as sent rather than regenerated, or the image would carry
      // different words than the ones the user approved on screen.
      //
      // Its audit travels with it and was produced by the audit_copy action
      // after the last edit. The interface blocks generation while an edit is
      // unchecked, so a block arriving here has been audited in its current
      // wording, not in some earlier wording.
      if (body.draftedCopy?.fields?.length) {
        displayCopyBlock = {
          copyTypeId: "headline_set",
          label: "Headline set",
          text: body.draftedCopy.fields.map((field) => field.text).filter(Boolean).join("\n"),
          fields: body.draftedCopy.fields,
          model: body.draftedCopy.model || null,
          edited: !!body.draftedCopy.edited,
          generatedAt: body.draftedCopy.generatedAt || new Date().toISOString(),
          audit: body.draftedCopy.audit || {
            status: "errored",
            message: "This copy arrived without a claim check, so it has not been checked against your claims.",
            findings: [],
            totals: null,
          },
        };
      } else {
        displayCopyBlock = await produceCopy({
          copyTypeId: "headline_set",
          brain: approvedBrain,
          product,
          claimsSet: claimsSet || { approved: [], prohibited: [], disclosures: [] },
          context: {
            placement: body.brief?.placement || "",
            copyDirection: body.copyDirection || "",
            scene: body.brief?.scene || "",
            exclusions: body.brief?.exclusions || "",
            displayBudgets: displayBudgets({ format, zoneId, fieldIds: body.displayFields || ["headline"] }),
          },
          apiKey: options.env.OPENAI_API_KEY,
        });
      }
      const wanted = new Set(body.displayFields || ["headline"]);
      displayCopy = {
        zoneId,
        format,
        lines: (displayCopyBlock.fields || [])
          .filter((field) => wanted.has(field.id) && field.text)
          .map((field) => {
            // The design ratios travel with the line so the prompt can state
            // the hierarchy proportionally rather than in absolute sizes.
            const design = designFor(field.id);
            return { id: field.id, label: field.label, text: field.text, ...design };
          }),
      };
      if (!displayCopy.lines.length) displayCopy = null;
    } catch (error) {
      displayCopyError = error.message || "The display copy could not be written.";
    }
  }

  const generationPackage = compileBrandWorldImagePackage({
    approvedBrain,
    brainVersion,
    brief: body.brief,
    references,
    lockedAsset,
    templateAsset,
    campaign: body.campaign || null,
    product,
    copyOutputs,
    claimsSet,
    displayCopy,
    refusals,
    // ADR 0018 phase 1 look test. Carried on the brief so it travels with the
    // job through both preflight and generate without a new request field, and
    // so a package records which look produced it.
    look: body.brief?.look || null,
  });
  if (generationPackage.copy) {
    generationPackage.copy.displayCopyError = displayCopyError;
    // The block was produced before the render, so it is already done. It is
    // carried forward rather than regenerated, or the image would carry one
    // headline and the package would record a different one.
    if (displayCopyBlock) generationPackage.copy.preproduced = [displayCopyBlock];
  }
  return { generationPackage, references, lockedAsset, templateAsset, stored, approvedBrain, product, claimsSet };
}

// A copy output is declared by id. Unknown ids are dropped rather than
// failing the job: an image that generated is worth more than a hard stop on
// a catalog entry the client no longer has.
function resolveCopyOutputs(requested) {
  if (!Array.isArray(requested)) return [];
  return requested
    .map((entry) => (typeof entry === "string" ? entry : entry?.copyTypeId))
    .filter((id) => typeof id === "string" && id.length > 0)
    .slice(0, 4);
}

function publicJob(job, imageUrl) {
  if (!job) return null;
  return {
    ...job,
    imageUrl: job.imagePublicUrl || imageUrl || undefined,
    imagePathname: undefined,
    imagePublicUrl: undefined,
    errorDetail: undefined,
  };
}

export async function readProductionJob(options) {
  const job = await options.productionStore.read();
  const imageUrl = job?.status === "complete" && job.imagePathname && options.productionStore.imageUrl
    ? await options.productionStore.imageUrl(job.imagePathname)
    : null;
  return publicJob(job, imageUrl);
}

// A render outruns the platform's gateway timeout, and the gateway retries the
// invocation. On 2026-08-11 that produced two renders of one job sixty seconds
// apart, both writing to the same blob path, so the second silently replaced
// an image the user had already approved.
//
// Two windows govern the response. A duplicate that arrives while the original
// is still rendering waits for it and returns its result, so a retry becomes a
// reader rather than a second renderer. A record still marked working long
// after any render could plausibly still be running is treated as abandoned,
// so a crashed job does not lock its own id forever.
const IN_FLIGHT_POLL_INTERVAL_MS = 2000;
const IN_FLIGHT_WAIT_LIMIT_MS = 200000;
const ABANDONED_AFTER_MS = 300000;

function startedMillisecondsAgo(record) {
  const started = Date.parse(record?.createdAt || "");
  if (Number.isNaN(started)) return Infinity;
  return Date.now() - started;
}

export async function generateProductionImage(body, options) {
  const jobId = safeId(body.jobId, "The production job ID");
  const current = await options.productionStore.read();
  if (current?.jobId === jobId && current.status === "complete") return readProductionJob(options);

  // A duplicate invocation of a job that is still rendering waits for the
  // original rather than starting a second render.
  if (current?.jobId === jobId && current.status === "working" && startedMillisecondsAgo(current) < ABANDONED_AFTER_MS) {
    const deadline = Date.now() + IN_FLIGHT_WAIT_LIMIT_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, IN_FLIGHT_POLL_INTERVAL_MS));
      const latest = await options.productionStore.read();
      if (latest?.jobId !== jobId) break;
      if (latest.status === "complete" || latest.status === "error") return readProductionJob(options);
    }
    // Still running at the limit. Report the job as working rather than
    // starting a competing render; the client recovers it from the current
    // job endpoint.
    return readProductionJob(options);
  }

  // Identifies this invocation. If a competing attempt takes ownership of the
  // record while this one is rendering, this attempt discards its result
  // rather than overwriting the blob the other attempt wrote.
  const attemptId = `${jobId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const { generationPackage, references, lockedAsset, templateAsset, approvedBrain, product, claimsSet } = await prepareProductionPackage(body, options);

  // The template (when present) is the first reference image: the base layer
  // the element is composed onto. The locked asset follows as the identity
  // source, then creative references.
  const allReferenceEntries = [];
  if (templateAsset) {
    allReferenceEntries.push({ file: templateAsset.file, name: templateAsset.fileName, isTemplate: true });
  }
  if (lockedAsset) {
    allReferenceEntries.push({ file: lockedAsset.file, name: lockedAsset.fileName, isLockedAsset: true });
  }
  for (const ref of references) {
    allReferenceEntries.push({ file: ref.file, name: ref.file.name, isLockedAsset: false });
  }

  const working = {
    jobId,
    attemptId,
    status: "working",
    createdAt: new Date().toISOString(),
    model: OPENAI_IMAGE_MODEL,
    endpoint: chooseOpenAIImageEndpoint(allReferenceEntries),
    generationPackage,
  };
  await options.productionStore.write(working);

  try {
    const referenceImages = await Promise.all(
      allReferenceEntries.map(async (entry) => {
        const storedFile = await options.brainStore.readSourceFile(entry.file.blobPathname);
        return {
          name: entry.name,
          type: storedFile.mimeType || entry.file.type,
          bytes: storedFile.bytes,
        };
      }),
    );
    const result = await (options.render || renderWithOpenAIImages)({
      apiKey: options.env.OPENAI_API_KEY,
      prompt: generationPackage.prompt,
      referenceImages,
      model: OPENAI_IMAGE_MODEL,
      size: generationPackage.output.size,
      quality: "medium",
      outputFormat: "png",
      fetchImpl: options.fetchImpl || fetch,
    });
    const image = result?.data?.[0];
    if (!image?.b64_json) throw new Error("OpenAI returned no image data.");
    const bytes = Buffer.from(image.b64_json, "base64");

    // Last check before anything durable is written. If another attempt has
    // taken over this job, its image is the one the user will see, and
    // writing here would replace it. Abandon instead.
    const ownerBeforeWrite = await options.productionStore.read();
    if (ownerBeforeWrite?.jobId === jobId && ownerBeforeWrite.attemptId && ownerBeforeWrite.attemptId !== attemptId) {
      return readProductionJob(options);
    }

    const savedImage = await options.productionStore.writeImage(jobId, bytes, "image/png");

    // Governed copy (ADR 0014 step 2). The copy runs after the image so a
    // copy failure never costs a render that already succeeded. Each block
    // carries its own audit; a block that could not be produced is recorded
    // as a failure rather than silently omitted, because a missing caption
    // and a caption nobody checked look identical otherwise.
    if (generationPackage.copy) {
      const produced = [];
      const preproduced = new Map((generationPackage.copy.preproduced || []).map((block) => [block.copyTypeId, block]));
      for (const declared of generationPackage.copy.declared) {
        if (preproduced.has(declared.copyTypeId)) {
          produced.push(preproduced.get(declared.copyTypeId));
          continue;
        }
        try {
          produced.push(await produceCopy({
            copyTypeId: declared.copyTypeId,
            brain: approvedBrain,
            product,
            claimsSet: claimsSet || { approved: [], prohibited: [], disclosures: [] },
            context: {
              placement: generationPackage.output?.placement || "",
              copyDirection: body.copyDirection || "",
              scene: generationPackage.brief?.scene || "",
              exclusions: generationPackage.brief?.exclusions || "",
            },
            apiKey: options.env.OPENAI_API_KEY,
          }));
        } catch (error) {
          produced.push({
            copyTypeId: declared.copyTypeId,
            text: "",
            failed: true,
            error: error.message || "The copy could not be written.",
            audit: {
              status: "errored",
              message: "The copy was not produced, so nothing was checked against your claims.",
              findings: [],
              totals: null,
            },
          });
        }
      }
      generationPackage.copy.produced = produced;
      delete generationPackage.copy.preproduced;
    }
    // Persist the compiled package alongside the image so this output stays
    // reviewable after the current-job slot is reused. A failure here should not
    // lose an image that was generated successfully.
    if (options.productionStore.writeOutputPackage) {
      try {
        await options.productionStore.writeOutputPackage(jobId, {
          generationPackage,
          model: OPENAI_IMAGE_MODEL,
          endpoint: working.endpoint,
          savedAt: new Date().toISOString(),
        });
      } catch {
        // The output is still usable in-session; only later review is affected.
      }
    }
    const complete = {
      ...working,
      status: "complete",
      completedAt: new Date().toISOString(),
      imagePathname: savedImage.pathname,
      imageContentType: savedImage.contentType,
      imagePublicUrl: null,
      usage: result.usage || null,
    };
    await options.productionStore.write(complete);
    return readProductionJob(options);
  } catch (error) {
    // Only the attempt that owns the record may mark it failed. Without this,
    // a retried invocation that errors would overwrite the completed record
    // written by the attempt that succeeded, and a finished image would be
    // reported as a failure.
    const ownerOnFailure = await options.productionStore.read();
    const ownsRecord = !ownerOnFailure?.attemptId || ownerOnFailure.attemptId === attemptId;
    if (ownsRecord) {
      await options.productionStore.write({
        ...working,
        status: "error",
        failedAt: new Date().toISOString(),
        error: error.message || "The image could not be generated.",
      });
    }
    throw error;
  }
}


