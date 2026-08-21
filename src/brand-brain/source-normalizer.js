import path from "node:path";
import { OfficeParser } from "officeparser";

export const MAX_SOURCE_FILE_BYTES = 20 * 1024 * 1024;
const visionMimeTypes = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);
const directTextExtensions = new Set([".csv", ".htm", ".html", ".json", ".md", ".text", ".txt", ".xml"]);
const directTextMimeTypes = new Set([
  "application/json",
  "application/xml",
  "text/csv",
  "text/html",
  "text/markdown",
  "text/plain",
  "text/xml",
]);
const portableDocumentExtensions = new Set([".docx", ".pdf", ".pptx", ".rtf"]);

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,([\s\S]*)$/);
  if (!match) throw new Error("An uploaded file could not be decoded.");
  const mimeType = match[1] || "application/octet-stream";
  const bytes = match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]), "utf8");
  return { mimeType, bytes };
}

function cleanExtractedText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, 160_000);
}

async function extractPortableDocument(bytes, filename, extension) {
  try {
    const ast = await OfficeParser.parseOffice(bytes, {
      fileType: extension.slice(1),
      extractAttachments: false,
      ignoreComments: true,
      ocr: false,
    });
    const { value } = await ast.to("text", {
      includeImages: false,
      textConfig: { preserveLayout: false, renderNotes: true },
    });
    const text = cleanExtractedText(value);
    if (!text) throw new Error(`${filename} did not contain readable text.`);
    return text;
  } catch (error) {
    if (error.message?.includes(filename)) throw error;
    throw new Error(`Could not extract readable text from ${filename}. Convert it to PDF or plain text and try again.`);
  }
}

async function loadUploadedBytes(file, options) {
  if (file.data) return decodeDataUrl(file.data);
  if (file.blobPathname && options.readStoredFile) {
    const stored = await options.readStoredFile(file.blobPathname);
    return { mimeType: stored.mimeType || file.type || "application/octet-stream", bytes: stored.bytes };
  }
  return null;
}

export async function normalizeUploadedFile(file, source = {}, options = {}) {
  if (Number(file.size || 0) > MAX_SOURCE_FILE_BYTES) {
    const error = new Error(`${file.name || "The uploaded file"} is larger than the 20 MB source limit.`);
    error.status = 413;
    throw error;
  }
  const extension = path.extname(file.name || "").toLowerCase();
  if (!file.data && !file.blobPathname) return { kind: "metadata", name: file.name, type: file.type, size: file.size };
  if (source.authority === "exact-asset" && !visionMimeTypes.has(file.type)) {
    return {
      kind: "metadata",
      name: file.name,
      type: file.type,
      size: file.size,
      blobPathname: file.blobPathname,
      note: "Protected source preserved as supplied; this file format was not visually interpreted during synthesis.",
    };
  }
  const decoded = await loadUploadedBytes(file, options);
  if (!decoded) return { kind: "metadata", name: file.name, type: file.type, size: file.size };
  if (decoded.bytes.length > MAX_SOURCE_FILE_BYTES) {
    const error = new Error(`${file.name || "The uploaded file"} is larger than the 20 MB source limit.`);
    error.status = 413;
    throw error;
  }
  const mimeType = file.type || decoded.mimeType;
  if (visionMimeTypes.has(mimeType)) {
    const data = file.data || `data:${mimeType};base64,${decoded.bytes.toString("base64")}`;
    return { kind: "image", ...file, type: mimeType, data };
  }

  if (source.authority === "exact-asset") {
    return {
      kind: "metadata",
      name: file.name,
      type: mimeType,
      size: file.size,
      note: "Protected source preserved as supplied; this file format was not visually interpreted during synthesis.",
    };
  }

  if ([".doc", ".ppt"].includes(extension)) {
    throw new Error(`${file.name} uses an older Office format. Save it as DOCX, PPTX, or PDF and try again.`);
  }
  const text = directTextMimeTypes.has(mimeType) || directTextExtensions.has(extension)
    ? cleanExtractedText(decoded.bytes.toString("utf8"))
    : portableDocumentExtensions.has(extension)
      ? await extractPortableDocument(decoded.bytes, file.name || "uploaded document", extension)
      : (() => {
          throw new Error(`Could not read ${file.name || "the uploaded file"}. Convert it to PDF or plain text and try again.`);
        })();

  if (!text) throw new Error(`${file.name || "The uploaded file"} did not contain readable text.`);
  return { kind: "text", name: file.name, type: mimeType, size: file.size, text };
}

export async function normalizeSourcesForSynthesis(sources, options = {}) {
  return Promise.all(
    sources.map(async (source) => {
      const normalizedFiles = await Promise.all((source.files ?? []).map((file) => normalizeUploadedFile(file, source, options)));
      const extractedText = normalizedFiles.filter((file) => file.kind === "text").map((file) => `SOURCE FILE: ${file.name}\n${file.text}`);
      return {
        ...source,
        content: [source.content, ...extractedText].filter(Boolean).join("\n\n"),
        files: normalizedFiles.filter((file) => file.kind === "image"),
        extractedFiles: normalizedFiles.map(({ data: _data, text: _text, ...file }) => file),
      };
    }),
  );
}
