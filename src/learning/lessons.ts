import counter from "./content/counter.md?raw";
import blink from "./content/blink.md?raw";
import button from "./content/button.md?raw";
import lcd from "./content/lcd.md?raw";
import { PRESETS } from "../circuit/presets";
import {
  analyzeCircuit,
  lcdConnections,
  ledIsOn,
  type CircuitDoc,
} from "../circuit/model";
import type { Snapshot } from "../simulation/machine";

export type Check =
  | "read"
  | "led-wired"
  | "blink"
  | "fast-blink"
  | "button-wired"
  | "button-operated"
  | "lcd-wired"
  | "lcd-text"
  | "lcd-label"
  | "counter-wired"
  | "counter-count"
  | "counter-reset";
export type Lesson = {
  id: string;
  title: string;
  description: string;
  duration: string;
  preset: string;
  markdown: string;
  checks: Check[];
};
export const LESSONS: Lesson[] = [
  {
    id: "counter",
    title: "Build a button counter",
    description: "Combine code, buttons and a display into a complete project.",
    duration: "20 min",
    preset: "counter",
    markdown: counter,
    checks: ["read", "counter-wired", "counter-count", "counter-reset"],
  },
  {
    id: "blink",
    title: "Your first blinking LED",
    description: "Breadboard strips, polarity and timing.",
    duration: "10 min",
    preset: "blink",
    markdown: blink,
    checks: ["read", "led-wired", "blink", "fast-blink"],
  },
  {
    id: "button",
    title: "Let a button decide",
    description: "Inputs, pull-ups and program decisions.",
    duration: "10 min",
    preset: "button",
    markdown: button,
    checks: ["read", "button-wired", "button-operated", "read"],
  },
  {
    id: "lcd",
    title: "Say it on a screen",
    description: "Power rails, signals and your first text display.",
    duration: "15 min",
    preset: "lcd",
    markdown: lcd,
    checks: ["read", "lcd-wired", "lcd-text", "lcd-label"],
  },
];
export function lessonSteps(lesson: Lesson) {
  return lesson.markdown
    .split(/^## /m)
    .filter((s) => s.trim())
    .map((s, i) => ({
      title: s.split("\n")[0].trim(),
      markdown: s.slice(s.indexOf("\n")).trim(),
      check: lesson.checks[i],
    }));
}
export function lessonProject(lesson: Lesson) {
  const preset = PRESETS.find((p) => p.id === lesson.preset)!;
  const doc = preset.create();
  if (lesson.id === "blink") doc.wires = doc.wires.filter((w) => w.id !== "W1");
  const sketch =
    lesson.id === "lcd"
      ? preset.sketch.replace(
          '  lcd.print("Hello, Piko!");',
          '  // TODO: print "Hello, Piko!" on the first row.\n  // Add lcd.print(...) here.',
        )
      : preset.sketch;
  return { doc, sketch };
}
export type Evidence = {
  pressed: boolean;
  released: boolean;
  counted?: boolean;
  reset?: boolean;
};
export function observeButton(
  snapshot: Snapshot,
  doc: CircuitDoc,
  evidence: Evidence,
): Evidence {
  const input = snapshot.pins[2];
  const led = analyzeCircuit(doc).leds.find((l) => ledIsOn(l, snapshot.pins));
  return {
    pressed:
      evidence.pressed ||
      (input?.mode === "INPUT_PULLUP" && !input.high && !!led),
    released:
      evidence.released ||
      (evidence.pressed &&
        input?.mode === "INPUT_PULLUP" &&
        input.high &&
        !led),
  };
}
export function checkStep(
  check: Check,
  doc: CircuitDoc,
  snapshot: Snapshot,
  evidence: Evidence,
  source?: { sketch: string; compiledSource: string | null },
) {
  const runtimeChecks: Check[] = [
    "blink",
    "fast-blink",
    "button-operated",
    "lcd-text",
    "lcd-label",
    "counter-count",
    "counter-reset",
  ];
  if (
    source &&
    runtimeChecks.includes(check) &&
    source.compiledSource !== source.sketch
  )
    return {
      passed: false,
      message:
        "Run the current sketch before checking. Code edits do not change the running program until you rerun.",
    };
  const firstRow = snapshot.lcd?.[0]?.trim() || "";
  const analysis = analyzeCircuit(doc);
  const wired =
    !analysis.errors.length &&
    analysis.leds.some((l) => l.status === "ready" && l.source === 13);
  const timing = (ms: number) => {
    const edges = snapshot.traces[13]?.slice(-4) || [];
    return (
      edges.length >= 4 &&
      edges
        .slice(1)
        .every((edge, i) => Math.abs(edge.time - edges[i].time - ms) < 8)
    );
  };
  const counterWired =
    !!lcdConnections(doc) &&
    Object.hasOwn(analysis.inputs, 8) &&
    Object.hasOwn(analysis.inputs, 9);
  const results: Record<Check, [boolean, string]> = {
    "counter-wired": [
      counterWired,
      "Check D8 and D9 through their buttons to ground, and all LCD signals and power.",
    ],
    "counter-count": [
      counterWired && !!evidence.counted,
      "Run the project and press ADD twice. Hold once to see that a held button counts only once.",
    ],
    "counter-reset": [
      counterWired && !!evidence.reset,
      "After counting, press RESET until the LCD shows Count: 0.",
    ],
    read: [true, "Reflection recorded. Keep experimenting on the bench."],
    "led-wired": [
      wired,
      "Connect D13 to A5 and keep the resistor, LED polarity and ground return intact.",
    ],
    blink: [
      wired && timing(500),
      "Run the wired Blink sketch for at least two seconds; D13 should change every 500 ms.",
    ],
    "fast-blink": [
      wired && timing(100),
      "Change both delays to 100, then rerun and wait for several transitions.",
    ],
    "button-wired": [
      wired && Object.hasOwn(analysis.inputs, 2),
      "Check the D2-to-button and button-to-GND paths, plus the LED branch.",
    ],
    "button-operated": [
      evidence.pressed && evidence.released,
      "While running, hold the button until the LED lights, then release until it goes off.",
    ],
    "lcd-wired": [
      !!lcdConnections(doc),
      "Connect LCD power, RW to GND, and six distinct GPIO signals.",
    ],
    "lcd-label": [
      !!lcdConnections(doc) && !!firstRow && firstRow !== "Hello, Piko!",
      "Replace the greeting with your own message of up to 16 characters, then rerun. The check looks at the first LCD row.",
    ],
    "lcd-text": [
      !!lcdConnections(doc) && firstRow === "Hello, Piko!",
      'Add lcd.print("Hello, Piko!"); after lcd.begin(16, 2) in setup(), then rerun until the greeting appears on the first row.',
    ],
  };
  const [passed, hint] = results[check];
  return {
    passed,
    message: passed ? "Check passed—your circuit and simulation agree." : hint,
  };
}

export function lessonStepCode(lesson: Lesson, index: number): string | null {
  const check = lesson.checks[index];
  if (check === "lcd-text") return lessonProject(lesson).sketch;
  if (
    check === "lcd-label" ||
    check === "fast-blink" ||
    check === "counter-reset"
  )
    return PRESETS.find((p) => p.id === lesson.preset)!.sketch;
  return null;
}

export function observeCounter(
  snapshot: Snapshot,
  previous: { counted: boolean; reset: boolean },
) {
  const count = /^Count:\s*(\d+)/.exec(snapshot.lcd?.[1] || "");
  if (!count) return previous;
  const fallingEdges = (pin: number) =>
    (snapshot.traces[pin] || []).filter(
      (edge, i, trace) => i > 0 && trace[i - 1].high && !edge.high,
    ).length;
  const counted =
    previous.counted ||
    (Number(count[1]) >= 2 &&
      snapshot.pins[8]?.mode === "INPUT_PULLUP" &&
      fallingEdges(8) >= 2);
  const reset =
    previous.reset ||
    (previous.counted &&
      Number(count[1]) === 0 &&
      snapshot.pins[9]?.mode === "INPUT_PULLUP" &&
      fallingEdges(9) > 0);
  return counted === previous.counted && reset === previous.reset
    ? previous
    : { counted, reset };
}
