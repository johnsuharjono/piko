# Piko

A tiny electronics lab in your browser. Write Arduino C++, run real Uno firmware, and connect code to circuit behavior.

## Run locally

Requires Node 24+ and pnpm 10+. On Apple Silicon, native toolchain setup also needs Homebrew and Xcode's command-line developer tools (full Xcode works).

```sh
pnpm install
pnpm setup:arduino
pnpm dev
```

Open **http://127.0.0.1:3000**, choose a project, and enter the workbench. Press **Start simulation** to run it. No account, API key, Arduino board, or external compilation service is needed. The first setup downloads the compiler and AVR core; compilation then works locally without internet.

```sh
pnpm test       # compiles actual Arduino sketches; run setup first
pnpm typecheck
pnpm build
pnpm start     # built Node server, also on 127.0.0.1:3000
```

## App flow

- **Home** (`/`): choose a first project, open an empty bench, or reopen a bench from the current session.
- **Explore projects** (`/learn`): introductions for the complete button counter, Blink, button input, and LCD text.
- **Project introduction** (`/learn/:lessonId`): outcome, components, lesson outline, and actions to start a fresh guided build or working example.
- **Workbench** (`/bench/:projectId`): project name, optional guide, resizable code editor on the left and live circuit on the right. Searchable parts and pin inspection open over the canvas without replacing code. Execution messages remain at the bottom.

Projects keep their name, sketch, circuit and lesson association together through `src/projects/store.ts`. This is deliberately **in-memory session state**: navigating preserves benches, while reloading starts fresh. The routed app does not read or write localStorage. Download/Open project provides explicit portable files across sessions. An expired bench URL shows a clear return-to-Home screen. No accounts, progress dashboard or cloud database is involved.

The project repository is the boundary for adding durable storage later. Old standalone component test fixtures still exercise legacy storage behavior, but that behavior is bypassed by the routed application. Starting projects never restores global sketch or circuit values.

## Stack

TanStack Start / React / TypeScript, Vite and Nitro's Node server output. Tailwind 4 and shadcn Base UI controls. SVG circuit canvas. Lazy-loaded CodeMirror editor and react-markdown lesson renderer. Effect 4.1.2 manages compilation requests, typed errors, temporary directories and cleanup. Arduino CLI compiles real C++ and AVR8js executes its ATmega328P firmware in a browser worker at a simulated 16 MHz.

The server is used for compilation; the browser owns ongoing simulation, wiring checks, pin inspection and traces. Run starts from setup, pause freezes execution, resume continues, and stop unlocks circuit edits. Editing code requires a fresh run. A worker executes bounded slices; runs stop at ten simulated minutes, and excessively rapid GPIO transitions produce an actionable error.

## Scope and limits

This is an **Uno R3 digital educational model** with an editable breadboard. The starter is D13 → R1 (330 Ω) → LED1 → GND, mounted across breadboard columns 5, 8, and 9. The board’s small L indicator follows D13 independently of the external LEDs.

Supported circuits are independent, resistor-limited LED branches: one GPIO output or the always-powered 5V terminal → one or more series resistors → one LED → GND. Resistors may also be on the ground side. Each branch needs its own resistor(s), with each value between 220 Ω and 1 kΩ. Sharing an output or ground between independent branches is supported. Shared limiting resistors, parallel resistor networks, resistor bypasses around LEDs, LED series chains, and multiple sources in a resistor network are not solved. The model reports open, reversed, bypassed, missing-resistor, or unsupported branches and holds those LEDs off. Direct power/output-to-GND shorts and directly joined output pins disable Run until fixed. GPIO terminals connected through a button or switch directly to GND are recognized as inputs. Use `INPUT_PULLUP`: open reads HIGH, closed reads LOW. Live contact states propagate into the emulated PIN register, so `digitalRead()` determines the program’s response. Configuring one of these contact-input pins as OUTPUT pauses execution with a wiring warning. Other input circuits, external pull-down networks, and analog inputs are not supported.

This uses real Arduino C++, not an interpreted syntax subset. AVR8js emulates the microcontroller, not every external device. Firmware needing unsupported peripherals or unattached sensors may compile without useful behavior. Libraries bundled with the installed AVR core are available; arbitrary library installation is not exposed in the UI. A0–A5 can be used as digital outputs, but no analog source, circuit-network solver, component failures, heat, or current measurements are simulated. Changing a resistor within the supported range does not calculate brightness. Source-level debugging remains future work.

## Build and wire

- Drag a component from the shelf onto the canvas. Clicking a shelf card only selects a placement tool; it does not add a component. After selection, Enter/Space on the canvas or an explicit canvas click places it as an accessible alternative. One Uno, one 30-column breadboard, up to 12 LEDs/resistors/buttons/switches, and 64 wires are supported. The Uno stays on the bench; everything can be moved, and the breadboard/components/wires can be deleted.
- Drag component bodies to move them. Both leads snap into distinct, unoccupied holes when they fit; green rings show mounted leads. Off-board components can be wired directly to their terminal rings. Rotate pivots around the first lead. Flip + / − reverses an LED’s polarity without moving its contacts.
- Click a terminal and then another terminal to add a wire. Escape cancels. **Connect…** provides shadcn Select endpoint pickers for keyboard wiring. Select a wire to recolor, move either endpoint, change its route, or delete it. Nonvertical wires have a selected midpoint handle to move their route vertically. Vertical jumpers stay straight. Wires connect at endpoints, never at visual crossings.
- Each column’s **a–e** holes connect together; **f–j** form a separate strip. The center gap does not connect them. Each individual power rail is split between columns **15 and 16**. Rail +/− markings supply no power on their own. Hover a terminal to highlight its connected net; **Show breadboard strips** reveals the five-hole groups.
- Tab to a component and use arrow keys to move it in 16-unit steps. Breadboard holes use arrow-key navigation; Enter/Space starts or completes a wire. Delete/Backspace deletes a selection when focus is on the canvas. Buttons also expose every essential edit.
- Circuit editing, placement, deletion, and Undo/Redo are locked during compilation and while running or paused; stop first to edit. Every committed circuit edit resets the stopped firmware state. Live button presses and switch toggles are inputs, not edits, so they do not restart execution. While stopped, drag the body of a control freely; while running, hold/toggle its center to operate it. Contact positions are transient simulation state and reset after refreshing or loading a preset; mechanical bounce is not simulated. Press **Run** to test the changed wiring. Sketch edits continue to use the existing rerun behavior. Circuit Undo/Redo does not change the sketch. **Clear circuit** is undoable and preserves your code. **Restore Blink** loads both starter wiring and its matching Blink sketch; **Undo preset** restores your previous circuit and sketch together.
- The routed app saves wiring and sketch together in the current session project. The history is session-only. Guided projects open their instructions beside the canvas. Code, inspection and console start closed. **Code** opens a side panel (a full panel on narrow screens); **Inspect** and Help use the right tools panel without closing desktop instructions. The canvas toolbar can hide/show the component shelf; drag empty space to pan, use the mouse wheel or +/− to zoom from 20% to 400%, and Fit to reset the view. On narrow screens, the shelf starts hidden. Connect pickers provide an alternative to targeting small holes.

Try moving W1’s start from D13 to D12 and setting `LED_PIN = 12` in the sketch. The external LED and selected D12 trace now follow D12 firmware; the onboard L indicator still follows D13. Move the ground jumper to the rail’s other half and bridge the split to restore the circuit. These are actual connectivity changes, not independent animations.

The local server is for your own sketches. It runs a native compiler with your user permissions; do not expose this compiler endpoint to untrusted users. Public hosting would need an isolated compiler container/service with OS-level CPU, memory, filesystem, and network limits. The current service limits request size, concurrent compiles, output size, and compilation time, but those limits are not an OS sandbox. It deliberately has no database or cloud deployment configuration.

## Presets and live inputs

The top-left preset picker loads matching wiring and code for **Blink**, **Traffic light**, **Alternating LEDs**, **Button light**, **Switch light**, or **Empty bench**, or **LCD · Hello Piko**. Loading a preset stops execution; press Start simulation to run it. **Undo preset** restores both the previous sketch and circuit. Regular circuit undo remains independent of the sketch.

Buttons and slide switches are ideal two-terminal contacts. In the input presets, D2 is `INPUT_PULLUP` and the contact closes to GND. Hold the button’s center, or click the slide switch’s center, while running. The GPIO input changes through the actual circuit connections; removing the ground wire means the control no longer drives LOW. Button release/cancel restores the open contact. Input changes while paused update the external signal but never advance simulation time or the CPU’s outputs; the sketch sees them on resume. Switch state persists until toggled again in that session.

## Toolchain setup

`pnpm setup:arduino` installs Arduino CLI **1.5.1** and Arduino AVR core **1.8.8** into ignored `.arduino/`. CLI archives are verified against Arduino's release checksums. Nothing is uploaded to Wokwi's demo compilation endpoint.

Arduino's AVR distribution currently contains Intel-only macOS compiler and ctags binaries. For Apple Silicon on macOS 15+, setup uses project-local native AVR GCC **14.4.0** and binutils **2.47_1** from osx-cross's Homebrew bottles, verified against release SHA-256 metadata. It builds Arduino's ctags **5.8-arduino11** from verified source with a small SDK macro-compatibility fix. These binaries stay under `.arduino/`; Homebrew installs their shared-library dependencies (`gmp`, `isl`, `libmpc`, `mpfr`, `zstd`). macOS 26+ uses Tahoe bottles; macOS 15 uses Sequoia bottles. This fallback does not require Rosetta. Linux x64/ARM64 and Intel macOS use Arduino's distributed tools; those platforms have not been exercised here. Automatic Windows setup is not implemented.

Overrides for an existing installation:

- `ARDUINO_CLI`: absolute Arduino CLI executable path.
- `ARDUINO_CONFIG`: absolute CLI configuration path containing the installed AVR core.
- `ARDUINO_COMPILER_PATH`: optional native tool directory (including AVR compiler, binutils, and Arduino ctags).

Run from the project root so the default `.arduino/` paths resolve. Moving the project requires rerunning native setup because native-bin symlinks contain absolute paths. Delete `.arduino/native-bin` first to force regeneration after a move.

## Learning the codebase

Start with `src/server/compiler.ts` for Effect's `Schema`, `Data.TaggedError`, `Effect.gen`, `acquireRelease`, `scoped`, and `catchTag`. The compiler process has a 45-second timeout, and temporary directories are released after every result. `src/simulation/machine.ts` handles emulated hardware; `runtime.ts` schedules it; `worker.ts` is the worker boundary. `use-bench.ts` owns browser lifecycle and guards against late compilation responses after a reset or rerun. Rendering consumes snapshots, independently of instruction execution. `src/circuit/model.ts` contains terminal geometry, breadboard union-find connectivity, supported LED-branch analysis, mounting, and saved-document validation. `use-circuit.ts` owns circuit history; the session repository owns whole-project state. `components/circuit.tsx` supplies the interactive SVG editor.

Tests compile the unchanged Blink example and variants with real Arduino CLI, execute the returned firmware, and check timing, D12 rewiring and trace agreement, C++ helper functions, serial output, compiler diagnostics, execution limits, and lifecycle. Connectivity tests cover breadboard groups, split rails, shorts, polarity, resistor limits, shared-resistor rejection, mounting, and document validation. DOM tests exercise actual editor controls, pointer dragging, endpoint reconnection, keyboard placement, undo/redo, clearing/restoring, and persistence. Workspace tests also exercise Select pickers, non-modal inspector/help navigation, preset loading/undo, deliberate drag/keyboard placement, wheel zoom limits, live contacts, code-panel state retention, and drag placement under transformed SVG coordinates. All preset sketches compile using the real AVR toolchain. Input tests verify button/switch press, release, disconnected ground, pause/resume, input traces, and resulting LED output from compiled firmware. These are not full browser visual tests.

## Upstream licenses

AVR8js is MIT licensed. Arduino CLI is GPL-3.0; Arduino AVR core headers identify LGPL-2.1-or-later. GCC and binutils, Arduino ctags, and their dependencies retain their upstream licenses and notices in their downloaded distributions. shadcn component sources are copied into the repository and use Base UI primitives. See the upstream projects for full terms:

- https://github.com/wokwi/avr8js
- https://github.com/arduino/arduino-cli
- https://github.com/arduino/ArduinoCore-avr
- https://github.com/arduino/ctags
- https://github.com/osx-cross/homebrew-avr
- https://github.com/shadcn-ui/ui
- https://github.com/mui/base-ui


The camera uses the actual available canvas size. At **100%**, one drawing unit equals one CSS pixel, so a 4K monitor shows more work area rather than larger components. Initial framing and Fit never enlarge above 100%; narrow canvases fit down. Resizing or opening a panel preserves zoom and the viewed center. Pan on empty space, use the zoom buttons or wheel, and use Fit to return to the circuit. Components can be placed beyond the original starter layout, including negative coordinates; saved positions and manual wire routes support ±100,000 drawing units.


### LCD first milestone

Choose **LCD · Hello Piko**, then Start simulation. The 16×2 character display shows a greeting and elapsed seconds from compiled Arduino `LiquidCrystal` code. It is also available in the component tray. One display is supported; select its body to show the editing controls, drag to move it, or use arrow keys to nudge it. Delete/Backspace or the Delete control removes the display and its attached wires; Undo restores them. LCD editing is locked during simulation like other components. Wire its labeled terminals. This educational module fixes contrast/backlight internally and exposes GND, 5V, RW, RS, E, D4–D7. Connect RW to GND for write-only operation. Signal pins are resolved through the actual circuit nets before each run. Disconnected power or incomplete signals leave the display blank with a wiring warning.

The worker decodes falling enable edges in HD44780 4-bit mode. This first version supports printable ASCII, two DDRAM rows, clear/home, setCursor, display/noDisplay and entry direction. Custom characters, cursor visuals, display scrolling, readback/busy polling, 8-bit mode and I²C backpacks are outside this milestone. It does not model contrast voltage, backlight current, or electrical timing violations. Setup installs LiquidCrystal 1.0.7 alongside the AVR core.


### Learn by building

The four Markdown guides live in `src/learning/content/*.md`. Each second-level heading is a step, paired with a check definition in `src/learning/lessons.ts`. Guided projects start with the appropriate circuit and sketch. The Blink project begins with one missing jumper. Checks validate real circuit connectivity and simulated timings; the button check observes pressed/on and released/off behavior; the LCD check verifies signal mapping and displayed text. Read/reflection steps are self-reported and stay in the current open guide. Cross-session progress is deferred.

Desktop instructions remain visible while switching between Code and Inspect. Narrow screens use separate views to leave room for the circuit or code. The tools panel has a keyboard-accessible resize separator on desktop. Opening an example inside a guide is undoable; starting another project from the catalog creates a separate bench.

### Brand

Piko's circuit-inspired P mark and wordmark are in `public/piko-mark.svg` and `public/piko-logo.svg`. The matching SVG favicon is `public/favicon.svg`. The repository folder and package are named `piko`.


### Coding tasks and step resets

Guided LCD benches start with a TODO in setup() instead of a finished greeting. The learner adds lcd.print(), runs the program, then changes the message in the next step. Checks read the executed first LCD row and reject stale compiled code. Each coding task exposes **Reset step code**: it stops execution and restores that task’s scaffold, preserving wiring. The custom-label task resets to the completed greeting, while the first-print task resets to the TODO. The working-example entry still opens the complete sketch.

The code editor has no example dropdown or unrelated code-only restore action. Project examples are chosen from the catalog and open separate benches with matching circuits and code. Code folding is enabled using the gutter arrows, with bracket matching and auto-closing brackets. This remains a C++ editor; a visual block-programming editor is a separate future feature. The code pane starts at 440 px and resizes up to 720 px, subject to available space. Parts and inspection are contextual canvas panels.


## Simulator-first rebuild

The featured **Build a button counter** project combines an Uno, two named pushbuttons and a 16×2 LCD. D8 is ADD and D9 is RESET. Both are INPUT_PULLUP contacts returning through the breadboard ground rail. Edge detection counts once per press; holding ADD does not keep counting. RESET sets count to zero. The guide follows the complete circuit, highlights relevant pins/nets and checks executed LCD output plus recorded input transitions. Real contact bounce remains outside the digital model.

`src/circuit/components.ts` is the shared definition registry for component identities, pin geometry, sizes, instance limits and simulation driver kinds. Rendering and runtime stay separate. The existing, tested editor circuit representation is retained behind an adapter; `src/projects/format.ts` exposes a uniform parts-and-connections diagram for portable projects. This is an incremental foundation change, not a replacement of the firmware emulator or an analog solver.

Use **Download** to export `.piko.json`, then **Open a .piko.json project** on Home to import it as a separate session bench. Format version 1 contains a name, Uno board configuration, `sketch.ino`, a structured `diagram.json` and a validated library manifest. It currently supports one sketch, one Uno, at most one LCD and breadboard, and the existing digital parts. Unknown boards, unsupported libraries/files, invalid pins and oversized input are rejected. Imported projects never overwrite an open bench.

Sign-in, cloud persistence and sharing are deferred. The session repository remains the integration boundary for a future backend. File tabs expose editable C++ and a read-only live circuit document. Guides, code and circuit can be visible together on desktop; smaller screens expose them as separate views.


### Visual direction

Application chrome uses a dark Poimandres-inspired palette: midnight surfaces, mint primary actions, and pink/purple highlights. The code editor uses a matching syntax theme with translucent active-line highlighting so text selection remains visible. Hardware keeps recognizable physical colors. The guide owns detailed instructions; the canvas only exposes names, controls and actionable feedback. Palette reference: https://github.com/drcmda/poimandres-theme
