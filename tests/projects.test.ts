import { expect, it } from "vitest";
import {
  createProject,
  getProject,
  listProjects,
  saveProject,
} from "./project-repository";
it("starts each bench independently and stores circuit and sketch as a single session project", () => {
  const a = createProject("blink", true),
    b = createProject("lcd", false);
  expect(a.id).not.toBe(b.id);
  expect(a.lessonId).toBe("blink");
  expect(a.circuit.wires).toHaveLength(3);
  expect(b.circuit.lcd).toBeTruthy();
  const previous = structuredClone(b);
  a.name = "My timing experiment";
  a.sketch = a.sketch.replaceAll("500", "100");
  a.circuit.wires = [];
  saveProject(a);
  expect(getProject(a.id)).toMatchObject({
    name: a.name,
    sketch: a.sketch,
    circuit: a.circuit,
  });
  expect(getProject(b.id)).toEqual(previous);
  const again = createProject("blink", true);
  expect(again.circuit.wires).toHaveLength(3);
  expect(again.sketch).toContain("delay(500)");
});
it("does not expose mutable stored state, handles missing sessions, and rejects invalid updates", () => {
  const p = createProject();
  const read = getProject(p.id)!;
  read.circuit.parts = [];
  read.name = "Other";
  expect(getProject(p.id)?.name).not.toBe("Other");
  expect(getProject("missing")).toBeNull();
  const draft = createProject();
  draft.sketch = "";
  saveProject(draft);
  expect(getProject(draft.id)?.sketch).toBe("");
  expect(() => saveProject({ ...p, name: "" })).toThrow();
  expect(() =>
    saveProject({
      ...p,
      circuit: { ...p.circuit, uno: { x: Infinity, y: 0 } },
    }),
  ).toThrow();
  expect(listProjects().find((item) => item.id === p.id)).toEqual(p);
  expect(() => createProject("missing")).toThrow();
});
