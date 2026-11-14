import { expect, it } from "vitest";
import {
  LESSONS,
  lessonProject,
  lessonSteps,
  lessonStepCode,
  checkStep,
  observeButton,
} from "../src/learning/lessons";
import { PRESETS } from "../src/circuit/presets";
import { analyzeCircuit, parseCircuit, terminals } from "../src/circuit/model";
import { INITIAL } from "../src/simulation/machine";
const evidence = { pressed: false, released: false };
it("pairs Markdown sections with explicit check definitions and opens a working example", () => {
  for (const lesson of LESSONS) {
    const steps = lessonSteps(lesson);
    expect(steps).toHaveLength(lesson.checks.length);
    expect(steps.every((s) => s.title && s.markdown && s.check)).toBe(true);
    expect(parseCircuit(lessonProject(lesson).doc)).not.toBeNull();
  }
  const doc = lessonProject(LESSONS.find(l=>l.id === "blink")!).doc;
  expect(checkStep("led-wired", doc, INITIAL, evidence).passed).toBe(true);
  doc.wires = doc.wires.filter(w => w.id !== "W1");
  expect(checkStep("led-wired", doc, INITIAL, evidence).passed).toBe(false);
  doc.wires.push({
    id: "W1",
    from: "uno:D13",
    to: "bb:BB1:A:5",
    color: "#e5a16f",
  });
  expect(checkStep("led-wired", doc, INITIAL, evidence).passed).toBe(true);
  expect(checkStep("blink", doc, INITIAL, evidence).passed).toBe(false);
});
it("checks executed timing rather than the sketch text or a lit output alone", () => {
  const doc = PRESETS.find((p) => p.id === "blink")!.create();
  const snapshot = structuredClone(INITIAL);
  snapshot.traces[13] = [0, 100, 200, 300].map((time, i) => ({
    time,
    high: i % 2 === 0,
  }));
  expect(checkStep("fast-blink", doc, snapshot, evidence).passed).toBe(true);
  expect(checkStep("blink", doc, snapshot, evidence).passed).toBe(false);
  snapshot.traces[13] = [0, 500, 1000, 1500].map((time, i) => ({
    time,
    high: i % 2 === 0,
  }));
  expect(checkStep("blink", doc, snapshot, evidence).passed).toBe(true);
  doc.wires = [];
  expect(checkStep("blink", doc, snapshot, evidence).passed).toBe(false);
});
it("requires both pressed and released behavior on the button input and LED", () => {
  const doc = PRESETS.find((p) => p.id === "button")!.create();
  const snapshot = structuredClone(INITIAL);
  snapshot.pins[2] = { number: 2, mode: "INPUT_PULLUP", high: false };
  snapshot.pins[13] = { number: 13, mode: "OUTPUT", high: true };
  const held = observeButton(snapshot, doc, evidence);
  expect(held).toEqual({ pressed: true, released: false });
  expect(checkStep("button-operated", doc, snapshot, held).passed).toBe(false);
  snapshot.pins[2].high = true;
  snapshot.pins[13].high = false;
  const released = observeButton(snapshot, doc, held);
  expect(checkStep("button-operated", doc, snapshot, released).passed).toBe(
    true,
  );
});
it("keeps LCD power on the breadboard and all preset wire paths off the glass", () => {
  const doc = PRESETS.find((p) => p.id === "lcd")!.create();
  expect(doc.breadboards).toHaveLength(1);
  expect(parseCircuit(doc)).toEqual(doc);
  expect(analyzeCircuit(doc).connected("lcd:5V", "uno:5V")).toBe(true);
  const positions = new Map(terminals(doc).map((t) => [t.id, t]));
  const glass = {
    left: doc.lcd!.x + 21,
    right: doc.lcd!.x + 219,
    top: doc.lcd!.y + 22,
    bottom: doc.lcd!.y + 90,
  };
  for (const w of doc.wires) {
    const a = positions.get(w.from)!,
      b = positions.get(w.to)!;
    const points = w.via
      ? [a, ...w.via, b]
      : [a, { x: a.x, y: w.routeY! }, { x: b.x, y: w.routeY! }, b];
    for (let i = 1; i < points.length; i++) {
      const p = points[i - 1],
        q = points[i];
      const crosses =
        p.x === q.x
          ? p.x > glass.left &&
            p.x < glass.right &&
            Math.max(p.y, q.y) > glass.top &&
            Math.min(p.y, q.y) < glass.bottom
          : p.y > glass.top &&
            p.y < glass.bottom &&
            Math.max(p.x, q.x) > glass.left &&
            Math.min(p.x, q.x) < glass.right;
      expect(crosses, `Wire ${w.id} crosses glass`).toBe(false);
    }
  }
  const invalid = structuredClone(doc);
  invalid.wires[0].via = [{ x: Infinity, y: 0 }];
  expect(parseCircuit(invalid)).toBeNull();
});

it("opens the LCD article with working code and verifies real first-row output", () => {
  const lesson = LESSONS.find((l) => l.id === "lcd")!;
  const project = lessonProject(lesson);
  expect(project.sketch).toContain('  lcd.print("Hello, Piko!");');
  const snapshot = structuredClone(INITIAL);
  snapshot.lcd = ["                ", "Seconds: 0      "];
  expect(checkStep("lcd-text", project.doc, snapshot, evidence).passed).toBe(
    false,
  );
  snapshot.lcd[0] = "Hello, Piko!".padEnd(16);
  expect(checkStep("lcd-text", project.doc, snapshot, evidence).passed).toBe(
    true,
  );
  expect(checkStep("lcd-label", project.doc, snapshot, evidence).passed).toBe(
    false,
  );
  snapshot.lcd[0] = "My first LCD!".padEnd(16);
  expect(checkStep("lcd-label", project.doc, snapshot, evidence).passed).toBe(
    true,
  );
  expect(
    checkStep("lcd-label", project.doc, snapshot, evidence, {
      sketch: "new code",
      compiledSource: "old code",
    }).passed,
  ).toBe(false);
  project.doc.wires = [];
  expect(checkStep("lcd-label", project.doc, snapshot, evidence).passed).toBe(
    false,
  );
});

it("resets each code task to its own starting point", () => {
  const lcd = LESSONS.find((l) => l.id === "lcd")!;
  expect(lessonStepCode(lcd, 0)).toBeNull();
  expect(lessonStepCode(lcd, 2)).toContain("// TODO:");
  expect(lessonStepCode(lcd, 3)).toContain('lcd.print("Hello, Piko!");');
  expect(lessonStepCode(LESSONS.find(l=>l.id === "blink")!, 3)).toContain("delay(500)");
});
