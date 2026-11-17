# Durable projects

## State and ownership

`@piko/project-model` owns the versioned document and the circuit/component model. Both Convex and the browser validate the same structure. A saved document contains the project name, Arduino sketch, circuit positions/properties/wires and optional guide identity. Firmware, running time, input switch state, selections, open panels and undo history are not persisted.

`apps/backend/convex/projects.ts` is the persistence boundary. Every public function resolves its caller from Better Auth and enforces ownership on the server. Project IDs alone grant no access. Creates have idempotency keys. Saves use an expected revision and mutation ID so stale writes conflict and retries do not duplicate a commit. Deletes also require the revision the user confirmed. Projects are private; sharing/public project URLs are not implemented.

`ProjectDraft` is the editing/save state machine. It holds a baseline revision, the newest local draft and at most one frozen in-flight save. It debounces edits, serializes saves and only displays Saved after an acknowledgement. Edits made during an in-flight save are not replaced by that response. An uncertain request is retried with the same mutation ID. Navigation does not dispose pending drafts; the app provider owns them for the current identity.

A separate IndexedDB journal holds only unacknowledged content, scoped by owner and project. It is cleared after a successful save. Reload recovers an unsent draft against the server revision; if the saved project changed, recovery becomes a conflict instead of overwriting it. IndexedDB is not the project repository, and project documents are never stored in localStorage. When browser recovery storage is unavailable, the UI warns while changes are pending. Closing/reloading with unsaved edits uses the native browser warning where supported. Browsers can evict recovery storage, so it is a recovery aid, not a cloud save guarantee.

On a conflict, keep the saved version or save the open edits as a separate project. A deleted/inaccessible open project keeps an exportable draft. Remote updates to a clean draft remount the bench and stop simulation; a reload always starts the simulation stopped. Authentication changes clear the prior identity's in-memory projects and drafts.

## Guest and signed-in accounts

Better Auth's anonymous plugin creates a guest identity and a persistent HTTP-only session cookie. The guest can create and reopen cloud projects without signing up. Clearing/expiring the cookie loses guest access; it is not cross-device identity. Sign in with GitHub for durable account access. The anonymous-link callback transfers project ownership atomically before the old anonymous account is removed.

Guest workspaces are limited to 20 projects and signed-in workspaces to 200. Project documents are capped at 200 KB, sketches at 32,000 characters, and circuits at the supported topology/component limits. Linking is rejected rather than silently hiding projects if the combined account would exceed its limit. No arbitrary C++ executes on the backend: compilation and simulation stay in browser workers.

GitHub login is only shown as available when the backend has both provider credentials. Development and production use separate secrets and OAuth registrations. The development registration uses:

- Homepage: `http://127.0.0.1:3000`
- Callback: `http://127.0.0.1:3000/api/auth/callback/github`

The production registration uses:

- Homepage: `https://piko.johnnicholas.workers.dev`
- Callback: `https://piko.johnnicholas.workers.dev/api/auth/callback/github`

Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` on the corresponding Convex deployment, not in a VITE variable or in the repository. Authentication is proxied through the website's `/api/auth/*` route; the browser never receives provider secrets.

## Local development

```sh
pnpm install
pnpm setup:backend
pnpm dev
```

On first setup, log into Convex and select/create your own development project. Setup configures development auth defaults if missing and writes ignored frontend public connection URLs. `pnpm dev` prepares browser compiler assets, watches Convex functions and starts Vite. Ctrl+C stops both children. `pnpm dev:wasm` is an alias. `pnpm dev:native` explicitly starts the optional native compiler and web app.

The local `.env.local` files are ignored. No database documents are uploaded by frontend builds. Tests use explicit fixtures/in-memory repositories, never an invisible production fallback. Without a configured backend, the app reports that saving is unavailable and prevents project creation.

The maintained Piko project has an isolated development deployment (`vivid-octopus-688`) and production deployment (`clean-nightingale-161`). Their data, users, cookies and auth secrets are separate. `deploy/convex.json` contains only public production endpoint URLs. Vite serve uses local development URLs; production builds deliberately ignore local `.env.local` and use the production endpoints (or explicit `PIKO_BUILD_CONVEX_URL` / `PIKO_BUILD_CONVEX_SITE_URL` process overrides for staging). Forks must replace the production endpoints before deploying.

## Checks

```sh
pnpm typecheck
pnpm test:unit
pnpm test:wasm
pnpm build
# While the local website is running, against the development backend only:
pnpm check:projects
```

Unit tests cover document validation, owner isolation, create/save idempotency, stale updates/deletes, account transfer, edits during saves, offline retry and reload recovery/conflicts. `check:projects` uses the actual same-origin auth proxy, guest cookies and real development deployment, verifies fresh-client project restoration and access isolation, then deletes its temporary projects/accounts. It refuses production deployments. No cookies or tokens are logged.

## Deployment

The frontend remains one Cloudflare deployment. Its existing `pnpm build:wasm` command is supported and now aliases the standard browser build. No compiler service or D1 binding is required. Convex is the separate managed project backend.

GitHub Actions deploys the backend after checks pass on main, using the repository's production-scoped `CONVEX_DEPLOY_KEY` Actions secret. Pull requests never receive this secret. Frontend builds use public production URLs from `deploy/convex.json`, so Cloudflare needs no auth-provider or database secrets. Production auth secrets live only in Convex.

Cloudflare's Git integration and GitHub Actions run independently. Deploy compatible backend additions first (`pnpm deploy:backend`) before publishing a frontend that requires them; do not rely on their concurrent pipelines for breaking schema/API changes. Version project schemas and migrate existing documents before removing fields/functions. Backend deployment changes code/schema, not development documents or users.
