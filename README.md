# Piko

A small electronics playground: connect a circuit, edit real Arduino C++, and run its firmware in a browser worker.

## Repository

```text
apps/web/                   TanStack Start, React, SVG circuits, CodeMirror, Markdown guides
apps/compiler/              Node HTTP service and Effect-managed Arduino compilation
packages/compile-contract/  Request limits, validation and response types
packages/browser-compiler/  Opt-in WASM compiler worker and independent Uno build driver
scripts/                    Local development and toolchain setup
tests/                      Integration and simulation checks
.github/workflows/          Checks and an optional compiler-image build
```

The website targets Cloudflare Workers. The compiler is a separate Docker service for a VPS. Both remain in one pnpm workspace; no Turborepo, database or account system is required.

## Local development

Requires Node 24+, pnpm 10.15.0, and an internet connection for initial toolchain installation.

```sh
pnpm install
pnpm setup:arduino
pnpm dev
```

Open http://127.0.0.1:3000. The compiler listens on loopback port 3001. The first `pnpm dev` generates `apps/web/.dev.vars` containing a random local service token; it is ignored by Git. Starting development does not deploy to Cloudflare. Stop with Ctrl+C to stop both services.

Arduino CLI 1.5.1, Arduino AVR core 1.8.8 and LiquidCrystal 1.0.7 are installed in the ignored root `.arduino/` directory. On Apple Silicon, setup prepares native ARM tools; Homebrew is needed for their shared libraries. Linux uses the Arduino-distributed toolchain. The Docker image installs Linux tools during its build; it does not copy your Mac binaries.

## Browser compiler experiment

Run `pnpm dev:wasm` for frontend-only development with real AVR compilation in a browser worker. Run `pnpm test:wasm` for firmware behavior checks and `pnpm build:wasm` for the optional build. The default production path remains unchanged. See [scope, commands and distribution prerequisites](docs/browser-compiler.md).

## Checks and builds

```sh
pnpm typecheck
pnpm test:unit
pnpm test
pnpm build
```

`test:unit` does not require Arduino tools. The full suite includes real firmware compilation and emulation, and requires `pnpm setup:arduino` first. Outputs are `apps/web/dist/` and `apps/compiler/dist/index.mjs`.

Builds are independent:

```sh
pnpm --filter @piko/web build
pnpm --filter @piko/compiler build
```

## How it works

The browser POSTs a sketch to the website’s `/api/compile`. That Worker route validates it and forwards it to the compiler’s `/compile` endpoint with a server-only service token. The compiler runs Arduino CLI with one compilation job and returns Intel HEX firmware or compiler diagnostics. Effect manages exclusive access, temporary files, cancellation and errors. No native compiler dependencies are included in the website build.

AVR8js executes the firmware in a dedicated browser Web Worker. It sends snapshots of pins, traces, serial output and LCD contents to React. Buttons and switches update simulated digital inputs without backend requests. Pausing retains machine state; stopping resets it. Editing code requires a fresh run. Wiring is locked while compiling or running.

## Projects and guides

Home opens a playground or project article. Articles are ordinary Markdown in `apps/web/src/learning/content/`, rendered alongside the bench. Each example starts with matching, working code and wiring. There are no course completion gates or reading progress records.

Open projects live in an in-memory session repository. Navigation preserves work; reload starts fresh. The app never reads or writes localStorage. Use **Project → Export project** to keep code and wiring together as `.piko.json`, then reopen the file from Home. Imported files are validated and create a separate bench. No cloud saving or sign-in is implemented.

The header theme menu offers Light, Dark, and System. Dark uses the Poimandres-inspired palette; light uses slate/teal. System follows OS appearance changes. The choice stays in memory for the session.

## Circuit model

The Uno, breadboard, resistors, LEDs, buttons, switches and one 16×2 LCD use a digital educational model. Real AVR firmware drives them; no analog network solver, measured current, contact bounce or analog LCD contrast is claimed. The simplified LCD exposes a four-bit interface with fixed contrast/backlight.

Drag components from the palette. Click terminals to wire them. Select a component or wire and press Delete/Backspace to remove it; Undo restores it. The keyboard supports selection, nudging and breadboard-hole navigation. Inspect shows selected digital pins and their trace. The code editor supports folding and text selection; visual block programming is not implemented.

## Deployment

See [deployment setup](docs/deployment.md) for Cloudflare secrets, Docker/VPS configuration, image publishing and verification. No paid resources are created by local setup, builds, or tests. The image-publishing workflow is manual and does not deploy a server.
