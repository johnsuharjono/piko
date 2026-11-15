import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { validateSketch } from "../packages/compile-contract/src/index";
import { compileSketch } from "../apps/compiler/src/compiler";
import { STARTER, experiments } from "../apps/web/src/lib/examples";
import {
  INITIAL,
  Machine,
  loadHex,
  type Snapshot,
} from "../apps/web/src/simulation/machine";
import { SimulationRuntime } from "../apps/web/src/simulation/runtime";
import type { Reply } from "../apps/web/src/simulation/protocol";

import { analyzeCircuit, ledIsOn, starterCircuit } from "../apps/web/src/circuit/model";

import { lcdConnections } from "../apps/web/src/circuit/model";
import {
  LESSONS,
  lessonProject,
} from "../apps/web/src/learning/lessons";
import { PRESETS } from "../apps/web/src/circuit/presets";
const firmware = new Map<string, string>();
async function compile(source: string) {
  const result = await Effect.runPromise(compileSketch(source));
  if (!result.ok) throw new Error(result.message);
  return result.hex;
}
function advance(machine: Machine, ms: number) {
  for (let n = 0; n < ms; n += 8) machine.advance(Math.min(8, ms - n));
}
beforeAll(async () => {
  for (const [name, code] of [
    ["blink", STARTER],
    ["pin12", STARTER.replace("= 13", "= 12")],
    ["duty", experiments[1].code],
    ["pattern", experiments[2].code],
    ["noLow", experiments[3].code],
    [
      "fast",
      "void setup(){pinMode(13,OUTPUT);} void loop(){digitalWrite(13,HIGH);digitalWrite(13,LOW);}",
    ],
    [
      "serial",
      'void setup(){Serial.begin(9600);Serial.println("Hello, Piko!");} void loop(){}',
    ],
  ])
    firmware.set(name, await compile(code));
  for (const preset of PRESETS.filter((p) => p.id !== "blink"))
    firmware.set(preset.id, await compile(preset.sketch));
});
afterEach(() => vi.useRealTimers());

describe("real compiled Arduino Uno firmware", () => {
  it("runs the unchanged starter with half-second transitions and agreeing pin states", () => {
    const m = new Machine(firmware.get("blink")!);
    advance(m, 10);
    expect(m.snapshot().pins[13]).toMatchObject({ mode: "OUTPUT", high: true });
    advance(m, 500);
    expect(m.snapshot().pins[13].high).toBe(false);
    advance(m, 500);
    const edges = m.trace.slice(1);
    expect(edges.map((e) => e.high)).toEqual([true, false, true]);
    expect(edges[1].time - edges[0].time).toBeCloseTo(500, 0);
    expect(edges[2].time - edges[1].time).toBeCloseTo(500, 0);
    expect(m.snapshot().pins[13].high).toBe(edges.at(-1)!.high);
  });
  it("drives the rewired LED and selected-pin trace from actual D12 firmware", () => {
    const m = new Machine(firmware.get("pin12")!);
    const doc = starterCircuit();
    doc.wires[0].from = "uno:D12";
    const branch = analyzeCircuit(doc).leds[0];
    advance(m, 10);
    expect(ledIsOn(branch, m.snapshot().pins)).toBe(true);
    expect(m.snapshot().pins[13].high).toBe(false);
    expect(m.snapshot().traces[13]).toEqual([{ time: 0, high: false }]);
    advance(m, 500);
    expect(ledIsOn(branch, m.snapshot().pins)).toBe(false);
    const trace = m.snapshot().traces[12];
    expect(trace.slice(1).map((edge) => edge.high)).toEqual([true, false]);
    expect(trace[2].time - trace[1].time).toBeCloseTo(500, 0);
  });
  it("executes changed duty-cycle timing rather than extracting a delay", () => {
    const m = new Machine(firmware.get("duty")!);
    advance(m, 1100);
    const e = m.trace.slice(1);
    expect(e[1].time - e[0].time).toBeCloseTo(100, 0);
    expect(e[2].time - e[1].time).toBeCloseTo(900, 0);
  });
  it("supports real C++ helper functions and a short-short-long pattern", () => {
    const m = new Machine(firmware.get("pattern")!);
    advance(m, 1400);
    const e = m.trace.slice(1);
    const highs = e
      .filter((_, i) => i % 2 === 1)
      .map((edge, i) => edge.time - e[i * 2].time);
    expect(highs).toHaveLength(3);
    for (const [i, expected] of [100, 100, 600].entries())
      expect(highs[i]).toBeCloseTo(expected, 0);
  });
  it("keeps the output HIGH when the LOW write is removed", () => {
    const m = new Machine(firmware.get("noLow")!);
    advance(m, 1600);
    expect(m.trace.slice(1).map((e) => e.high)).toEqual([true]);
    expect(m.snapshot().pins[13].high).toBe(true);
  });
  it("captures UART output", () => {
    const m = new Machine(firmware.get("serial")!);
    advance(m, 100);
    expect(m.serial).toContain("Hello, Piko!");
  });
  it("bounds a rapidly switching sketch and provides an actionable error", () => {
    const m = new Machine(firmware.get("fast")!);
    expect(() => m.advance(100)).toThrow("Add a delay");
    expect(m.trace.length).toBeLessThanOrEqual(2048);
  });
  it("rejects corrupt firmware", () => {
    expect(() => loadHex(":0100000000FF\n:00000001FE")).toThrow("checksum");
  });
  it("returns actual line-specific compiler errors", async () => {
    const result = await Effect.runPromise(
      compileSketch(
        "void setup() {\n  this_is_not_valid();\n}\nvoid loop() {}",
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain(":2:");
      expect(result.message).toContain("this_is_not_valid");
    }
  });
  it("rejects malformed and oversized compile requests", () => {
    expect(() => validateSketch({ sketch: 42 })).toThrow();
    expect(() => validateSketch({ sketch: " ".repeat(33000) })).toThrow();
    expect(validateSketch({ sketch: STARTER })).toBe(STARTER);
  });
});

describe("simulation lifecycle", () => {
  it("freezes time and pins on pause, resumes, and starts fresh on rerun", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const messages: Reply[] = [];
    const runtime = new SimulationRuntime((reply) => messages.push(reply));
    const latest = () =>
      messages
        .filter(
          (r): r is { type: "snapshot"; snapshot: Snapshot } =>
            r.type === "snapshot",
        )
        .at(-1)!.snapshot;
    runtime.handle({ type: "start", hex: firmware.get("blink")! });
    vi.advanceTimersByTime(200);
    runtime.handle({ type: "pause" });
    const paused = latest();
    expect(paused.time).toBeGreaterThan(190);
    expect(paused.pins[13].high).toBe(true);
    const count = messages.length;
    vi.advanceTimersByTime(1000);
    expect(messages.length).toBe(count);
    runtime.handle({ type: "resume" });
    vi.advanceTimersByTime(400);
    runtime.handle({ type: "pause" });
    expect(latest().time).toBeGreaterThan(590);
    expect(latest().pins[13].high).toBe(false);
    runtime.handle({ type: "start", hex: firmware.get("blink")! });
    expect(latest().time).toBe(0);
    runtime.handle({ type: "pause" });
    expect(latest().time).toBeLessThan(10);
    runtime.dispose();
    const stoppedCount = messages.length;
    vi.advanceTimersByTime(1000);
    expect(messages.length).toBe(stoppedCount);
    expect(INITIAL.pins.every((p) => p.mode === "INPUT" && !p.high)).toBe(true);
  });
});

describe("interactive presets with actual AVR firmware", () => {
  for (const kind of ["button", "switch"])
    it(`reads a wired ${kind} through INPUT_PULLUP and follows its release`, () => {
      const preset = PRESETS.find((p) => p.id === kind)!,
        doc = preset.create(),
        id = kind === "button" ? "BTN1" : "SW1";
      const m = new Machine(firmware.get(kind)!);
      m.setInputs(analyzeCircuit(doc).inputs);
      advance(m, 20);
      expect(m.snapshot().pins[2]).toMatchObject({
        mode: "INPUT_PULLUP",
        high: true,
      });
      expect(m.snapshot().pins[13].high).toBe(false);
      m.setInputs(analyzeCircuit(doc, { [id]: true }).inputs);
      advance(m, 10);
      expect(m.snapshot().pins[2].high).toBe(false);
      expect(m.snapshot().pins[13].high).toBe(true);
      m.setInputs(analyzeCircuit(doc).inputs);
      advance(m, 10);
      expect(m.snapshot().pins[13].high).toBe(false);
      expect(m.snapshot().traces[2].at(-1)?.high).toBe(true);
      doc.wires = doc.wires.filter((w) => w.id !== "W5");
      m.setInputs(analyzeCircuit(doc, { [id]: true }).inputs);
      advance(m, 10);
      expect(m.snapshot().pins[13].high).toBe(false);
    });
  it("executes the three traffic phases on the pins used by the colored LEDs", () => {
    const m = new Machine(firmware.get("traffic")!);
    const a = analyzeCircuit(PRESETS.find((p) => p.id === "traffic")!.create());
    const lights = () => a.leds.map((led) => ledIsOn(led, m.snapshot().pins));
    advance(m, 20);
    expect(lights()).toEqual([true, false, false]);
    advance(m, 2000);
    expect(lights()).toEqual([false, false, true]);
    advance(m, 2000);
    expect(lights()).toEqual([false, true, false]);
  });
  it("updates inputs while running and paused without cancelling the worker clock", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const messages: Reply[] = [];
    const runtime = new SimulationRuntime((reply) => messages.push(reply));
    const latest = () =>
      messages
        .filter(
          (r): r is { type: "snapshot"; snapshot: Snapshot } =>
            r.type === "snapshot",
        )
        .at(-1)!.snapshot;
    runtime.handle({
      type: "start",
      hex: firmware.get("button")!,
      inputs: { 2: null },
    });
    vi.advanceTimersByTime(32);
    runtime.handle({ type: "pause" });
    const time = latest().time;
    runtime.handle({ type: "inputs", inputs: { 2: false } });
    expect(latest().time).toBe(time);
    expect(latest().pins[13].high).toBe(false);
    runtime.handle({ type: "resume" });
    vi.advanceTimersByTime(32);
    expect(latest().pins[13].high).toBe(true);
    runtime.handle({ type: "inputs", inputs: { 2: null } });
    vi.advanceTimersByTime(32);
    expect(latest().pins[13].high).toBe(false);
    expect(latest().time).toBeGreaterThan(time + 50);
    runtime.dispose();
  });
});

it("executes LiquidCrystal firmware through GPIO edges and updates both LCD rows", () => {
  const doc = PRESETS.find((p) => p.id === "lcd")!.create();
  const connections = lcdConnections(doc);
  expect(connections).toEqual({ rs: 12, enable: 11, data: [5, 4, 3, 2] });
  const m = new Machine(firmware.get("lcd")!, connections);
  advance(m, 150);
  expect(m.snapshot().lcd?.[0]).toBe("Hello, Piko!".padEnd(16));
  expect(m.snapshot().lcd?.[1]).toContain("Seconds: 0");
  advance(m, 1100);
  expect(m.snapshot().lcd?.[1]).toContain("Seconds: 1");
  doc.wires = doc.wires.filter((w) => w.to !== "lcd:5V");
  expect(lcdConnections(doc)).toBeNull();
  const disconnected = new Machine(firmware.get("lcd")!, lcdConnections(doc));
  advance(disconnected, 150);
  expect(disconnected.snapshot().lcd).toBeUndefined();
});

it("runs an article's LCD message experiment as real firmware", async () => {
  const lesson = LESSONS.find((l) => l.id === "lcd")!;
  const project = lessonProject(lesson);
  const pins = lcdConnections(project.doc);
  const original = new Machine(await compile(project.sketch), pins);
  advance(original, 150);
  expect(original.snapshot().lcd?.[0].trim()).toBe("Hello, Piko!");
  const custom = project.sketch.replace("Hello, Piko!", "My first LCD!");
  const edited = new Machine(await compile(custom), pins);
  advance(edited, 150);
  expect(edited.snapshot().lcd?.[0].trim()).toBe("My first LCD!");
});

it("runs the complete button counter from circuit inputs, counts once per hold, and resets the LCD", () => {
  const doc = PRESETS.find((p) => p.id === "counter")!.create();
  const lcd = lcdConnections(doc);
  expect(lcd).not.toBeNull();
  const m = new Machine(firmware.get("counter")!, lcd);
  const inputs = (controls: Record<string, boolean>) =>
    m.setInputs(analyzeCircuit(doc, controls).inputs);
  inputs({});
  advance(m, 150);
  expect(m.snapshot().lcd?.[1].trim()).toBe("Count: 0");
  inputs({ BTN1: true });
  advance(m, 50);
  expect(m.snapshot().lcd?.[1].trim()).toBe("Count: 1");
  advance(m, 500);
  expect(m.snapshot().lcd?.[1].trim()).toBe("Count: 1");
  inputs({});
  advance(m, 50);
  inputs({ BTN1: true });
  advance(m, 50);
  expect(m.snapshot().lcd?.[1].trim()).toBe("Count: 2");
  inputs({});
  advance(m, 50);
  inputs({ BTN2: true });
  advance(m, 50);
  expect(m.snapshot().lcd?.[1].trim()).toBe("Count: 0");
  inputs({});
  advance(m, 50);
  doc.wires = doc.wires.filter((w) => w.id !== "C1B");
  inputs({ BTN1: true });
  advance(m, 100);
  expect(m.snapshot().lcd?.[1].trim()).toBe("Count: 0");
});
