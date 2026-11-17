# Browser compiler

The `@piko/browser-compiler` workspace compiles real C++ to ATmega328P AVR firmware in a dedicated module Web Worker. The existing simulation worker executes the resulting Intel HEX without changes. It does not call `/api/compile`, run Arduino CLI in a browser, or interpret sketches.

## Try locally

```sh
pnpm install
pnpm dev
```

Open http://127.0.0.1:3000 and run a preset. This starts the web app and the Convex development watcher after `pnpm setup:backend`. No native compiler service or Docker is required for compilation. First Run downloads the toolchain; progress appears in the existing execution messages. Cancel/Stop, another Run, navigation/unmount, and the 45-second deadline terminate the compilation worker. Pause/resume remain simulation operations after compilation.

```sh
pnpm test:wasm
pnpm build:wasm
```

The first command runs the existing firmware behavior suite against actual WASM compiler output, plus diagnostics checks. Tests execute the same WASM artifacts under Node; they are not a browser performance or end-to-end browser compatibility benchmark. Client lifecycle tests use a mocked Worker. The second command creates the opt-in web build; it does not deploy.

Browser compilation is now the default. `pnpm dev:wasm` and `pnpm build:wasm` remain aliases for compatibility. `pnpm dev:native` selects the native compiler explicitly. There is no silent fallback between compilers.

## Boundaries

- `packages/browser-compiler/src/engine.ts`: independent Uno build driver, filesystem inputs, compiler/assembler/linker/objcopy stages; no React or browser globals except portable base64 decoding.
- `loader.ts`: static asset loading and tool factory imports.
- `worker.ts`: worker protocol and progress; owns compilation work.
- `client.ts`: worker creation, cancellation, timeout and disposal.
- `apps/web/src/compiler/index.ts`: build-time adapter selection and existing HTTP adapter, outside the simulator.
- `scripts/prepare-browser-compiler.mjs`: prepares a versioned static toolchain from the lockfile-pinned npm package. Only Uno core objects/headers and the vendored LiquidCrystal source are selected. Other MCU device headers and unrelated peripheral libraries are omitted. No additional stripping is performed. Native-mode builds use the regular public directory; browser builds use the generated asset directory.

Artifacts are generated into ignored `apps/web/.wasm-public/compiler/`. The same dependency and source inputs produce the same hashed asset path. Toolchain updates change the path, while the small manifest is revalidated. Normal browser HTTP caching is used; there is no project persistence or localStorage. No indefinite cache retention is promised. Asset sizes are reported and any individual file over Cloudflare's 25 MiB limit fails preparation. No precompressed assets are generated; actual transfer size depends on hosting response compression.

## Supported configuration

Experimental Uno only: AVR-GCC 7.3.0, Arduino AVR core 1.8.8, and LiquidCrystal 1.0.7. No LTO. Arduino.h is injected with `#line` so diagnostics refer to sketch lines. It accepts a single sketch with GCC's C++11 syntax. Unlike Arduino CLI, this first adapter does **not** generate function prototypes: declare helper functions before they are called, or add explicit prototypes. Missing libraries and invalid syntax are compiler errors. Library Manager, arbitrary board selection, multiple sketch files and filesystem imports are not supported. The linker enforces Uno application flash/SRAM region sizes. Program behavior and binary size can differ from native CLI output.

## Before public distribution

The published WASM toolchain contains GPL binaries but does not provide all corresponding source/build materials in its npm package. Do not treat upstream links as complete redistribution materials. Before shipping publicly, obtain and archive the compiler sources, local patches, build scripts and applicable license texts; include the core/library source and notices as well. See [third-party inventory](../packages/browser-compiler/THIRD_PARTY_NOTICES.md). The native service remains available as an alternative.

The current prototype intentionally prioritizes firmware correctness over download tuning. Browser compile latency, memory consumption and cross-browser behavior still need real-device measurement before making this the default.
