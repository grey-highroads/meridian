import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = resolve(repositoryRoot, "app");

const legacyStylesheets = new Set([]);

const legacyHexBaseline = new Map([
  ["app/landing.html", 13],
]);

const legacyInlineStyleBaseline = new Map([]);

const legacyStyleApiBaseline = new Map([]);

const hexValuePattern = /#[0-9a-f]{3,8}\b/gi;
const inlineStylePattern = /\bstyle\s*=/gi;
const styleApiPattern = /\.style\b/g;

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(entryPath));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

function countMatches(source, pattern) {
  return source.match(pattern)?.length || 0;
}

export function inspectDesignSource(path, source) {
  const extension = extname(path);
  const insideDesign = path.startsWith("app/design/");
  const violations = [];

  if (extension === ".css" && !insideDesign && !legacyStylesheets.has(path)) {
    violations.push(`${path}: Stylesheets must live in app/design/.`);
  }

  if (![".css", ".html", ".js", ".mjs"].includes(extension)) {
    return violations;
  }

  const hexCount = countMatches(source, hexValuePattern);
  const inlineStyleCount = countMatches(source, inlineStylePattern);
  const styleApiCount = extension === ".js" || extension === ".mjs" ? countMatches(source, styleApiPattern) : 0;
  const allowedHexCount = path === "app/design/tokens.css"
    ? hexCount
    : legacyHexBaseline.get(path) || 0;
  const allowedInlineStyleCount = legacyInlineStyleBaseline.get(path) || 0;

  if (hexCount > allowedHexCount) {
    violations.push(`${path}: Found ${hexCount} hex values. The allowed legacy count is ${allowedHexCount}. Put color values in app/design/tokens.css.`);
  }

  if (inlineStyleCount > allowedInlineStyleCount) {
    violations.push(`${path}: Found ${inlineStyleCount} inline styles. The allowed legacy count is ${allowedInlineStyleCount}. Use a class from app/design/.`);
  }

  const allowedStyleApiCount = legacyStyleApiBaseline.get(path) || 0;
  if (styleApiCount > allowedStyleApiCount) {
    violations.push(`${path}: Found ${styleApiCount} script-owned style changes. The allowed legacy count is ${allowedStyleApiCount}. Put presentation in app/design/ and toggle a class or state attribute.`);
  }

  return violations;
}

export async function inspectDesignBoundary() {
  const files = await listFiles(appRoot);
  const violations = [];

  for (const file of files) {
    const path = relative(repositoryRoot, file).split("\\").join("/");
    const extension = extname(file);

    if (![".css", ".html", ".js", ".mjs"].includes(extension)) {
      continue;
    }

    const source = await readFile(file, "utf8");
    violations.push(...inspectDesignSource(path, source));
  }

  return violations;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = await inspectDesignBoundary();
  if (violations.length) {
    console.error(violations.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Meridian design boundary is intact.");
  }
}
