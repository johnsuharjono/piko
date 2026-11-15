import { expect, it } from "vitest";
import { PRESETS } from "../apps/web/src/circuit/presets";
import { analyzeCircuit, parseCircuit, COLORS } from "../apps/web/src/circuit/model";
for (const preset of PRESETS)
  it(`${preset.label} has valid, persistent circuit data and supported wiring`, () => {
    const doc = preset.create(),
      a = analyzeCircuit(doc);
    expect(parseCircuit(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
    expect(a.errors).toEqual([]);
    expect(a.leds.every((led) => led.status === "ready")).toBe(true);
    if (preset.id === "button" || preset.id === "switch")
      expect(a.inputs).toEqual({ 2: null });
  });
it("a contact only drives the input when it is actually wired to ground", () => {
  const doc = PRESETS.find((p) => p.id === "button")!.create();
  expect(analyzeCircuit(doc, { BTN1: true }).inputs).toEqual({ 2: false });
  doc.wires = doc.wires.filter((w) => w.id !== "W5");
  expect(analyzeCircuit(doc, { BTN1: true }).inputs).toEqual({});
});
it("does not disguise a real short as a contact input", () => {
  const doc = PRESETS.find((p) => p.id === "button")!.create();
  doc.wires.push({ id: "W6", from: "uno:5V", to: "BTN1:0", color: COLORS[0] });
  expect(analyzeCircuit(doc, { BTN1: true }).errors.join(" ")).toContain(
    "5V is wired directly to GND",
  );
});
