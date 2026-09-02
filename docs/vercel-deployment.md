# Vercel deployment

Meridian runs as one Vercel project: the browser application built with Vite and served from `dist/`, four functions under `api/`, and one private Blob store. Nothing is shared with the Brand World System deployment.

## What the hosted installation includes

- The pages in `app/` are built with Vite and served from `dist/`.
- Four functions: `api/auth/login`, `api/tour`, `api/tour-upload`, `api/artist`. Every one requires a signed session except sign-in itself.
- The edge middleware decides which pages load for whom. Route handlers decide which actions run, from the role stored on the user, never from the cookie alone.
- Work files upload directly from the browser into the private Blob store through short-lived presigned URLs, scoped to the Scene and capped at 20 MB.
- OpenAI is called only from the server. `OPENAI_API_KEY` never reaches the browser build.
- Functions can run for up to 300 seconds, which the Intelligence reads need.

## One-time Vercel setup

1. In Vercel, choose **Add New, then Project** and import `grey-highroads/meridian` from GitHub.
2. Leave the project root at the repository root. The committed `vercel.json` supplies the framework, build command, output directory, and function duration.
3. Open the project's **Storage** tab, create a **Blob** store, choose **Private**, and connect it to this project. New connections use Vercel's automatic OIDC authentication. Older connections may instead add `BLOB_READ_WRITE_TOKEN`.
4. Open **Settings, then Environment Variables** and add:
   - `OPENAI_API_KEY`: the OpenAI project key for this installation
   - `OPENAI_MODEL`: optional; the Intelligence reads default to `gpt-5.6`
   - `MERIDIAN_OPERATOR`: the Higher Roads person, as `login:password:display name`
   - `MERIDIAN_CLIENT`: the client reviewer, as `login:password:display name`
5. Apply the variables to Production and Preview, then redeploy if Vercel asks. The session cookie is signed with a key derived from the two sign-in values, so a deployment missing either one must not serve traffic; the register entry "The session key comes from the two sign in values" in `docs/deferred-work.md` carries the reasoning and the condition for changing it.
6. Open the deployment and sign in with one of the two logins set above. The two people are written into storage the first time anyone signs in. Changing either value afterwards changes the environment value and not the stored person; people are managed on the Admin page after that.

Do not add real values to `.env.example`, Git, client-side code, or Vite variables beginning with `VITE_`.

## GitHub behavior

- A push to `main` creates the production deployment once Git integration is enabled.
- Other branches and pull requests create preview deployments.

## Local development

From the repository root:

```sh
pnpm dev
```

The pre-dev step builds the browser application, then `scripts/dev-server.js` runs the whole application at `http://localhost:4173`: every function under `api/`, the page gate from the middleware's own path sets, and the built pages. The handlers are the deployed handlers, so local runs use real storage and the real model.

`.env.local` may contain:

```text
OPENAI_API_KEY=your-local-project-key
MERIDIAN_OPERATOR=login:password:display name
MERIDIAN_CLIENT=login:password:display name
BLOB_READ_WRITE_TOKEN=token-for-a-dev-blob-store
```

The file is ignored by Git. Point `BLOB_READ_WRITE_TOKEN` at a separate development Blob store unless reading the deployed data is the point of the session.

## Failure guide

- **"Meridian needs both of its sign in values set before anyone can sign in."** Add `MERIDIAN_OPERATOR` and `MERIDIAN_CLIENT` and redeploy.
- **Blob authentication or upload error.** Confirm the private Blob store is connected to this project and environment, then redeploy. New connections authenticate with OIDC automatically; older connections may use `BLOB_READ_WRITE_TOKEN`.
- **An Intelligence read reports that the model is not configured.** Add `OPENAI_API_KEY` to that deployment environment and redeploy.
- **A page loads for the wrong role.** The page sets live in `middleware.js` and the action set in `api/tour/index.js`; both must name the surface.

## Custom domain

After the deployment is healthy, add the Meridian domain under **Settings, then Domains**. Vercel shows the DNS record to add at the provider that manages the parent domain.
