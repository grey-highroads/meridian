# Vercel deployment

Brand World System is configured to run as one Vercel project while keeping the current plain browser application and product behavior.

## What the hosted installation includes

- The browser application is built with Vite and served from `dist/`.
- Brand Brain read, save, and synthesis routes run as Vercel Functions.
- Source files upload directly from the browser into a private Vercel Blob store. They do not pass through the 4.5 MB Vercel Function request limit.
- Each browser upload uses a short-lived URL limited to that file and the 20 MB application cap. New Vercel projects authorize these URLs with OIDC, while older projects may use `BLOB_READ_WRITE_TOKEN`.
- The latest Brand Brain is stored in the same private Blob store and read without CDN caching.
- OpenAI is called only from the server. `OPENAI_API_KEY` is never included in the browser build.
- One shared installation password protects the hosted workspace. This is an access gate, not a user, role, or permissions system.
- Synthesis functions can run for up to 300 seconds, the current Hobby-plan maximum with Fluid compute.

## One-time Vercel setup

1. In Vercel, choose **Add New → Project** and import `grey-highroads/brand-world-system` from GitHub.
2. Leave the project root at the repository root. The committed `vercel.json` supplies the framework, build command, output directory, and function duration.
3. Open the project’s **Storage** tab, create a **Blob** store, choose **Private**, and connect it to this project. New connections use Vercel's automatic OIDC authentication. Older connections may instead add `BLOB_READ_WRITE_TOKEN`.
4. Open **Settings → Environment Variables** and add:
   - `OPENAI_API_KEY`: the OpenAI project key for this installation
   - `OPENAI_MODEL`: `gpt-5.6` (optional because this is already the application default)
   - `BRAND_WORLD_ACCESS_PASSWORD`: a strong password for this installation
5. Apply the variables to Production and Preview, then redeploy if Vercel asks.
6. Open the deployment. The browser sign-in uses username `brandworld` and the password set above.

Do not add real values to `.env.example`, Git, client-side code, or Vite variables beginning with `VITE_`.

## GitHub behavior

- A push to `main` creates the production deployment once Git integration is enabled.
- Other branches and pull requests create preview deployments.
- Vercel’s own preview protection can remain enabled in addition to the application access gate.

## Custom domain

After the Vercel deployment is healthy, add `brandworld.higher-roads.com` under **Settings → Domains**. Vercel will show the DNS record to add at the provider that manages `higher-roads.com`.

The subdomain is the public address. Vercel remains the host that runs the application, API functions, and private storage connection.

## Local development

From the repository root:

```sh
npm run dev
```

The pre-dev step builds the browser application, then the existing Node server runs at `http://localhost:4173`. Local source files continue to use the in-memory upload path and `.data/brand-brain.json`, so local development does not require Vercel Blob.

`.env.local` may contain:

```text
OPENAI_API_KEY=your-local-project-key
OPENAI_MODEL=gpt-5.6
```

The file is ignored by Git.

## Failure guide

- **“This Brand World installation still needs its access password configured.”** Add `BRAND_WORLD_ACCESS_PASSWORD` and redeploy.
- **Blob authentication or upload error.** Confirm the private Blob store is connected to this project, then redeploy. New connections use automatic OIDC authentication and do not need a manually created `BLOB_READ_WRITE_TOKEN`; older connections may still use that variable.
- **Upload fails before synthesis.** Confirm the Blob store is private and connected to the same Vercel project and environment.
- **Synthesis reports that OpenAI is not configured.** Add `OPENAI_API_KEY` to that deployment environment and redeploy.
- **A document has no readable text.** Save an older DOC or PPT as DOCX, PPTX, or PDF. For a scanned or image-only PDF, upload readable page images or an exported text PDF.

## Current boundary

This remains one isolated Brand World installation. It does not add accounts, roles, permissions, shared review, notification providers, or a multi-client data model. A future authentication layer can replace the shared access gate without changing the Brand Brain service or storage contract.
