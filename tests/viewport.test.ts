import { expect, it } from "vitest";
import { starterCircuit } from "../src/circuit/model";
import { fitView, resizedView, zoomView } from "../src/circuit/viewport";

it("keeps components at native CSS size on a 4K workbench", () => {
  const size = { width: 3616, height: 2017 };
  const camera = fitView(starterCircuit(), size);
  expect(camera.zoom).toBe(1);
  expect(524 * camera.zoom).toBe(524); // Breadboard width, independent of display size.
  const smaller = fitView(starterCircuit(), { width: 1696, height: 937 });
  expect(smaller.zoom).toBe(camera.zoom);
});

it("fits a circuit within a narrow viewport without enlarging it", () => {
  const size = { width: 600, height: 450 };
  const camera = fitView(starterCircuit(), size);
  expect(camera.zoom).toBeLessThan(1);
  const bounds = { left: 18, right: 924, top: 105, bottom: 520 };
  expect((bounds.left - camera.x) * camera.zoom).toBeGreaterThanOrEqual(0);
  expect((bounds.right - camera.x) * camera.zoom).toBeLessThanOrEqual(
    size.width,
  );
  expect((bounds.top - camera.y) * camera.zoom).toBeGreaterThanOrEqual(0);
  expect((bounds.bottom - camera.y) * camera.zoom).toBeLessThanOrEqual(
    size.height,
  );
});

it("preserves the viewed center and zoom when panels or monitor size change", () => {
  const before = { width: 3616, height: 2017 };
  const after = { width: 1600, height: 937 };
  const initial = { x: -800, y: -200, zoom: 0.8 };
  const resized = resizedView(initial, before, after);
  expect(resized.zoom).toBe(initial.zoom);
  expect(resized.x + after.width / 2 / resized.zoom).toBeCloseTo(
    initial.x + before.width / 2 / initial.zoom,
  );
  expect(resized.y + after.height / 2 / resized.zoom).toBeCloseTo(
    initial.y + before.height / 2 / initial.zoom,
  );
});

it("zooms around the cursor and supports zooming out on a large viewport", () => {
  const initial = { x: -1300, y: -700, zoom: 1 };
  const anchor = { x: 800, y: 300 };
  const zoomed = zoomView(initial, 0.8, anchor, { width: 3616, height: 2017 });
  expect((anchor.x - zoomed.x) * zoomed.zoom).toBeCloseTo(anchor.x - initial.x);
  expect((anchor.y - zoomed.y) * zoomed.zoom).toBeCloseTo(anchor.y - initial.y);
  expect(zoomed.zoom).toBe(0.8);
});
