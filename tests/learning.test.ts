import { expect, it } from "vitest";
import { LESSONS, lessonProject, guideSections } from "../apps/web/src/learning/lessons";
import { PRESETS } from "../apps/web/src/circuit/presets";
import { analyzeCircuit, parseCircuit, terminals } from "../apps/web/src/circuit/model";
it("opens every article with a working preset and nonempty sections", () => {
  for (const lesson of LESSONS) {
    expect(guideSections(lesson)).toHaveLength(4);
    expect(guideSections(lesson).every(s => s.title && s.markdown)).toBe(true);
    const initial = lessonProject(lesson);
    expect(parseCircuit(initial.doc)).not.toBeNull();
    const preset = PRESETS.find(p => p.id === lesson.preset)!;
    expect(initial.sketch).toBe(preset.sketch);
    expect(initial.doc).toEqual(preset.create());
  }
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
