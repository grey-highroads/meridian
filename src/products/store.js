import { get, list, put, del } from "@vercel/blob";

// Per-record product storage namespaced under the client. See ADR 0011 and
// ADR 0012. Each product record lives at its own key and versions
// independently of the brain and of other products.

function productsPrefix(clientId) {
  return `brand-world-system/clients/${clientId}/products/`;
}

function productPathname(clientId, productId) {
  return `${productsPrefix(clientId)}${productId}.json`;
}

function indexPathname(clientId) {
  return `${productsPrefix(clientId)}index.json`;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "product";
}

function shortId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toLowerCase();
}

// Generate a product id from the product name, matching the client store
// pattern: slugified name plus a short random suffix. The result conforms to
// the frozen identifier type (^[a-z0-9][a-z0-9._-]*$).
export function generateProductId(productName, existingIds = []) {
  const existing = new Set(existingIds);
  let id = `${slugify(productName)}-${shortId()}`;
  while (existing.has(id)) {
    id = `${slugify(productName)}-${shortId()}`;
  }
  return id;
}

export function createVercelBlobProductStore(options = {}) {
  const token = options.token || process.env.BLOB_READ_WRITE_TOKEN;
  const clientId = options.clientId || "default";
  const credentials = token ? { token } : {};

  async function readJsonBlobOrNull(pathname) {
    const result = await get(pathname, {
      access: "private",
      ...credentials,
      useCache: false,
    });
    if (!result) return null;
    if (result.statusCode !== 200 || !result.stream) {
      throw new Error("A stored product record could not be read.");
    }
    return JSON.parse(await new Response(result.stream).text());
  }

  async function writeJsonBlob(pathname, value) {
    await put(pathname, JSON.stringify(value), {
      access: "private",
      ...credentials,
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
  }

  return {
    // Read the product index for this client. Returns an array of summary
    // entries (product_id, product_name, version, status, updated_at).
    async listProducts() {
      const index = await readJsonBlobOrNull(indexPathname(clientId));
      return Array.isArray(index?.products) ? index.products : [];
    },

    // Read one full product record by id. Returns null when the product does
    // not exist.
    async readProduct(productId) {
      return readJsonBlobOrNull(productPathname(clientId, productId));
    },

    // Write a full product record and update the index. The record must
    // already carry product_id, product_name, and version.
    async writeProduct(record) {
      const productId = record.product_id;
      if (!productId) throw new Error("Product record is missing product_id.");

      await writeJsonBlob(productPathname(clientId, productId), record);

      // Update the index entry for this product.
      const index = await readJsonBlobOrNull(indexPathname(clientId));
      const products = Array.isArray(index?.products) ? index.products : [];
      const existing = products.findIndex((p) => p.product_id === productId);
      const entry = {
        product_id: productId,
        product_name: record.product_name,
        version: record.version,
        status: record.approved_at ? "approved" : "candidate",
        open_questions: (record.review_questions || []).filter((q) => !q.resolution).length,
        updated_at: new Date().toISOString(),
      };
      if (existing >= 0) {
        products[existing] = entry;
      } else {
        products.push(entry);
      }
      await writeJsonBlob(indexPathname(clientId), { products });

      return record;
    },

    // Delete a product record and remove it from the index.
    async deleteProduct(productId) {
      const pathname = productPathname(clientId, productId);
      try {
        await del(pathname, { ...credentials });
      } catch {
        // Already gone or never existed. Proceed to clean the index.
      }

      const index = await readJsonBlobOrNull(indexPathname(clientId));
      const products = Array.isArray(index?.products) ? index.products : [];
      const filtered = products.filter((p) => p.product_id !== productId);
      if (filtered.length !== products.length) {
        await writeJsonBlob(indexPathname(clientId), { products: filtered });
      }
    },
  };
}
