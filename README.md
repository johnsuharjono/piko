# Piko

An electronics playground: build a circuit, edit real Arduino C++, and run its firmware in your browser. Projects autosave to a private Convex workspace and survive reloads.

## Develop

Requires Node 24+ and pnpm 10.15.0.

```sh
pnpm install
pnpm setup:backend
pnpm dev
```

The first backend setup uses your Convex login and creates/connects a personal development deployment. It writes ignored local connection settings. `pnpm dev` prepares the WASM compiler, starts the Convex watcher and serves the website at http://127.0.0.1:3000. Ctrl+C stops both. `pnpm dev:wasm` remains an alias.

No Docker or native Arduino install is needed for the standard workflow. `pnpm dev:native` runs the retained native compiler alternative after `pnpm setup:arduino`. See [native deployment notes](docs/deployment.md) if you need that service.

## Structure

```text
apps/web/                   TanStack Start, React, editor, SVG circuits and Markdown guides
apps/backend/convex/        Better Auth, private project storage and ownership
apps/compiler/              Optional Node/Arduino CLI compilation service
packages/project-model/     Shared versioned project, circuit model and validation
packages/browser-compiler/  AVR-GCC WASM worker and Uno build driver
packages/compile-contract/  Compilation limits and result types
```

Cloudflare hosts the website and static compiler assets. Compilation and AVR8js simulation run in separate browser workers. Convex stores projects and authentication data; it never executes sketches. The website proxies auth through `/api/auth/*`, so provider secrets stay on Convex.

## Saving

A project saves its name, code, circuit positions/properties/wiring and guide identity together. Autosave is debounced and revision checked. “Saved” means acknowledged by the server. Edits made during a save survive its response; conflicts offer the saved version or a separate copy. Simulation state and transient UI state are not saved.

Guest sessions can save and reload without registration. Their persistent cookie is required to find their projects; clearing it loses guest access. GitHub sign-in enables cross-device account access once that deployment's OAuth credentials are configured. Guest projects transfer to the signed-in account. Home lists projects and supports duplication/deletion; examples always create a separate project.

There is no localStorage project repository. A small owner-scoped IndexedDB journal protects unacknowledged edits and is cleared after successful cloud saves. Export/import `.piko.json` remains available for portable backups.

See [state, authentication and environment design](docs/projects.md) for lifecycle details and setup.

## Checks and builds

```sh
pnpm typecheck
pnpm test:unit
pnpm test:wasm
pnpm build
# Optional real development-service integration, with the local app running:
pnpm check:projects
```

`pnpm test` runs the unit and WASM checks without native tools. `pnpm test:native` runs the optional native firmware suite after `pnpm setup:arduino`. The WASM suite compiles real firmware and verifies GPIO timing, inputs, serial and LCD output in the simulator. Unit checks cover ownership, revisions, retries, recovery, navigation and theme behavior.

`pnpm build:wasm` aliases the standard browser build. Production builds use public production endpoints in `deploy/convex.json` rather than a developer's local environment. Forks must replace these endpoints before deployment. The existing Cloudflare build command remains valid. Backend deployment is separate; see [deployment workflow](docs/projects.md#deployment).

The experimental WASM compiler's [third-party source/distribution inventory](packages/browser-compiler/THIRD_PARTY_NOTICES.md) records unresolved upstream reproduction materials. See [compiler scope](docs/browser-compiler.md) for supported boards and language/library limits.

## Circuit model

The Uno, breadboard, resistors, LEDs, buttons, switches and one 16×2 LCD use a digital educational model. Real AVR firmware drives them; no analog network solver, measured current, contact bounce or analog LCD contrast is claimed.

Drag components from the palette, connect terminals, edit code and run. While simulating, buttons and switches operate as inputs; stopping returns to circuit editing. Guides are Markdown articles with experiments alongside the bench. Light, Dark and System appearance use semantic theme variables; UI appearance stays in memory for the session.
