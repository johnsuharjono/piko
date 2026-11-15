import { describe, expect, it } from "vitest";
import {
  analyzeCircuit,
  COLORS,
  holeId,
  ledIsOn,
  mountPart,
  parseCircuit,
  partPosition,
  starterCircuit,
  type CircuitDoc,
  type Part,
} from "../apps/web/src/circuit/model";
import { INITIAL } from "../apps/web/src/simulation/machine";
const h = (row: Parameters<typeof holeId>[1], col: number) =>
  holeId("BB1", row, col);
const wire = (id: string, from: string, to: string) => ({
  id,
  from,
  to,
  color: COLORS[0],
});
const output = (pin: number, high = true) =>
  INITIAL.pins.map((p) =>
    p.number === pin ? { ...p, mode: "OUTPUT" as const, high } : p,
  );
const branch = (doc: CircuitDoc) => analyzeCircuit(doc).leds[0];

describe("breadboard connectivity and LED branch interpretation", () => {
  it("connects five-hole strips, isolates adjacent columns and the center gap, and splits each rail", () => {
    const a = analyzeCircuit({ ...starterCircuit(), parts: [], wires: [] });
    expect(a.connected(h("A", 5), h("E", 5))).toBe(true);
    expect(a.connected(h("A", 5), h("A", 6))).toBe(false);
    expect(a.connected(h("E", 5), h("F", 5))).toBe(false);
    expect(a.connected(h("F", 5), h("J", 5))).toBe(true);
    expect(a.connected(h("TP", 1), h("TP", 15))).toBe(true);
    expect(a.connected(h("TP", 15), h("TP", 16))).toBe(false);
    expect(a.connected(h("TP", 2), h("TN", 2))).toBe(false);
  });
  it("lights the starter only when its actual source pin is an output driven HIGH", () => {
    const doc = starterCircuit(),
      a = analyzeCircuit(doc);
    expect(a.errors).toEqual([]);
    expect(branch(doc)).toMatchObject({
      status: "ready",
      source: 13,
      resistors: ["R1"],
    });
    expect(ledIsOn(a.leds[0], INITIAL.pins)).toBe(false);
    expect(ledIsOn(a.leds[0], output(13))).toBe(true);
    expect(ledIsOn(a.leds[0], output(13, false))).toBe(false);
    const pullup = INITIAL.pins.map((p) =>
      p.number === 13 ? { ...p, mode: "INPUT_PULLUP" as const, high: true } : p,
    );
    expect(ledIsOn(a.leds[0], pullup)).toBe(false);
  });
  it("follows rewiring to D12, independently of D13", () => {
    const doc = starterCircuit();
    doc.wires[0].from = "uno:D12";
    const led = branch(doc);
    expect(led.source).toBe(12);
    expect(ledIsOn(led, output(13))).toBe(false);
    expect(ledIsOn(led, output(12))).toBe(true);
  });
  it("requires a jumper when the ground rail connection moves across its break", () => {
    const doc = starterCircuit();
    doc.wires[2].to = h("TN", 20);
    expect(branch(doc).status).toBe("open");
    doc.wires.push(wire("W4", h("TN", 15), h("TN", 16)));
    expect(branch(doc).status).toBe("ready");
  });
  it("detects disconnected leads, reversed polarity, bypassed LEDs, and missing resistors", () => {
    let doc = starterCircuit();
    doc.wires = doc.wires.slice(1);
    expect(branch(doc).status).toBe("open");
    doc = starterCircuit();
    doc.parts[1].flipped = true;
    expect(branch(doc).status).toBe("reversed");
    doc = starterCircuit();
    doc.wires.push(wire("W4", "LED1:0", "LED1:1"));
    expect(branch(doc).status).toBe("bypassed");
    doc = starterCircuit();
    doc.wires.push(wire("W4", "R1:0", "R1:1"));
    expect(branch(doc).status).toBe("missing-resistor");
    expect(ledIsOn(branch(doc), output(13))).toBe(false);
  });
  it("supports a resistor on the ground side and always-powered 5V branches", () => {
    const doc = starterCircuit();
    doc.breadboards = [];
    doc.parts = doc.parts.map((p) => ({ ...p, mounts: [null, null] }));
    doc.wires = [
      wire("W1", "uno:5V", "LED1:0"),
      wire("W2", "LED1:1", "R1:0"),
      wire("W3", "R1:1", "uno:GND"),
    ];
    expect(branch(doc)).toMatchObject({
      status: "ready",
      source: "5V",
      resistors: ["R1"],
    });
    expect(ledIsOn(branch(doc), INITIAL.pins)).toBe(true);
  });
  it("detects direct supply/ground shorts and joined outputs", () => {
    const doc = starterCircuit();
    doc.wires.push(wire("W4", "uno:5V", "uno:GND"));
    const a = analyzeCircuit(doc);
    expect(a.errors.join(" ")).toContain("5V is wired directly to GND");
    expect(ledIsOn(a.leds[0], output(13), !!a.errors.length)).toBe(false);
    doc.wires[3] = wire("W4", "uno:D13", "uno:D12");
    expect(analyzeCircuit(doc).errors.join(" ")).toContain(
      "Two power/output pins",
    );
  });
  it("supports independent LED branches and rejects a shared limiting resistor for both LEDs", () => {
    const doc = starterCircuit();
    doc.breadboards = [];
    doc.parts = doc.parts.map((p) => ({ ...p, mounts: [null, null] }));
    doc.parts.push(
      { ...doc.parts[0], id: "R2" },
      { ...doc.parts[1], id: "LED2" },
    );
    doc.wires = [
      wire("W1", "uno:D13", "R1:0"),
      wire("W2", "R1:1", "LED1:0"),
      wire("W3", "LED1:1", "uno:GND"),
      wire("W4", "uno:D12", "R2:0"),
      wire("W5", "R2:1", "LED2:0"),
      wire("W6", "LED2:1", "uno:GND"),
    ];
    expect(analyzeCircuit(doc).leds.map((l) => l.status)).toEqual([
      "ready",
      "ready",
    ]);
    doc.parts = doc.parts.filter((p) => p.id !== "R2");
    doc.wires = doc.wires.filter((w) => !["W4", "W5"].includes(w.id));
    doc.wires.push(wire("W4", "LED1:0", "LED2:0"));
    expect(analyzeCircuit(doc).leds.map((l) => l.status)).toEqual([
      "unsupported",
      "unsupported",
    ]);
  });
  it("rejects ambiguous parallel resistor networks instead of guessing an electrical result", () => {
    const doc = starterCircuit();
    doc.parts.push({ ...doc.parts[0], id: "R2", mounts: [null, null] });
    doc.wires.push(wire("W4", "R1:0", "R2:0"), wire("W5", "R1:1", "R2:1"));
    expect(branch(doc).status).toBe("unsupported");
  });
});

describe("component mounting and saved circuits", () => {
  it("snaps both leads to matching holes and refuses occupied holes", () => {
    const doc = starterCircuit();
    const r: Part = {
      ...doc.parts[0],
      id: "R2",
      x: 630,
      y: 236,
      mounts: [null, null],
    };
    const placed = mountPart(doc, r);
    expect(placed.mounts).toEqual([h("B", 12), h("B", 15)]);
    const led = mountPart(doc, {
      ...doc.parts[1],
      id: "LED2",
      ...partPosition(doc, doc.parts[1]),
      mounts: [null, null],
    });
    expect(led.mounts).toEqual([null, null]);
  });
  it("keeps plugged-in parts attached when the breadboard moves", () => {
    const doc = starterCircuit(),
      before = partPosition(doc, doc.parts[0]);
    doc.breadboards[0].x += 50;
    doc.breadboards[0].y += 20;
    expect(partPosition(doc, doc.parts[0])).toEqual({
      x: before.x + 50,
      y: before.y + 20,
    });
    expect(branch(doc).status).toBe("ready");
  });
  it("round-trips a saved circuit and rejects corrupt endpoints, duplicate IDs, and invalid coordinates", () => {
    const doc = starterCircuit();
    expect(parseCircuit(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    doc.wires[0].to = "bb:missing:A:1";
    expect(parseCircuit(doc)).toBeNull();
    const d = starterCircuit();
    d.parts[1].id = d.parts[0].id;
    expect(parseCircuit(d)).toBeNull();
    const broken = starterCircuit();
    broken.uno.x = NaN;
    expect(parseCircuit(broken)).toBeNull();
    expect(parseCircuit(null)).toBeNull();
  });
});
