import { expect, it } from "vitest";
import { PRESETS } from "../apps/web/src/circuit/presets";
import {
  toDiagram,
  fromDiagram,
  encodeProject,
  decodeProject,
} from "../apps/web/src/projects/format";
import { createProject, importProject, getProject } from "./project-repository";
import { COMPONENTS } from "../apps/web/src/circuit/components";
it("round-trips every supported component and working circuit through the portable format", () => {
  for (const preset of PRESETS) {
    const doc = preset.create();
    const diagram = toDiagram(doc);
    expect(fromDiagram(diagram)).toEqual(doc);
    for (const part of diagram.components)
      expect(COMPONENTS[part.type]).toBeTruthy();
    const encoded = encodeProject({
      name: preset.label,
      circuit: doc,
      sketch: preset.sketch,
    });
    expect(decodeProject(encoded)).toEqual({
      name: preset.label,
      circuit: doc,
      sketch: preset.sketch,
    });
  }
});
it("imports a separate session project without overwriting the original and rejects unsupported files atomically", () => {
  const original = createProject("counter");
  const imported = importProject(encodeProject(original));
  expect(imported.id).not.toBe(original.id);
  expect(imported.circuit).toEqual(original.circuit);
  imported.sketch = "";
  expect(getProject(original.id)?.sketch).toBe(original.sketch);
  const bad = JSON.parse(encodeProject(original));
  bad.board = "esp32";
  expect(() => importProject(JSON.stringify(bad))).toThrow(/board/);
  bad.board = "arduino:avr:uno";
  bad.libraries = [{ name: "Unknown", version: "1" }];
  expect(() => decodeProject(JSON.stringify(bad))).toThrow(/library/);
  expect(() => decodeProject("x".repeat(200001))).toThrow(/200 KB/);
  expect(() => decodeProject("{")).toThrow(/valid/);
});
it("rejects duplicate IDs, missing boards and connections to nonexistent pins", () => {
  const d = toDiagram(PRESETS.find((p) => p.id === "counter")!.create());
  const duplicate = structuredClone(d);
  duplicate.components.push(duplicate.components[0]);
  expect(() => fromDiagram(duplicate)).toThrow();
  const noBoard = structuredClone(d);
  noBoard.components = noBoard.components.filter((c) => c.type !== "uno");
  expect(() => fromDiagram(noBoard)).toThrow();
  d.connections[0].to = "lcd:missing";
  expect(() => fromDiagram(d)).toThrow(/wiring/);
});
