import { partPosition, terminals, type CircuitDoc, type Point } from "./model";
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 4;
export type View = { x: number; y: number; zoom: number };
export type ViewportSize = { width: number; height: number };
export const DEFAULT_VIEWPORT: ViewportSize = { width: 1040, height: 640 };
export function zoomView(
  view: View,
  factor: number,
  anchor?: Point,
  size = DEFAULT_VIEWPORT,
): View {
  const pivot = anchor || {
    x: view.x + size.width / 2 / view.zoom,
    y: view.y + size.height / 2 / view.zoom,
  };
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom * factor));
  return {
    x: pivot.x - ((pivot.x - view.x) * view.zoom) / zoom,
    y: pivot.y - ((pivot.y - view.y) * view.zoom) / zoom,
    zoom,
  };
}
export function resizedView(
  view: View,
  before: ViewportSize,
  after: ViewportSize,
): View {
  return {
    ...view,
    x: view.x + (before.width - after.width) / 2 / view.zoom,
    y: view.y + (before.height - after.height) / 2 / view.zoom,
  };
}
export function fitView(doc: CircuitDoc, size: ViewportSize): View {
  const points: Point[] = [
    { x: doc.uno.x - 12, y: doc.uno.y },
    { x: doc.uno.x + 300, y: doc.uno.y + 240 },
    ...terminals(doc),
  ];
  if (doc.lcd) points.push(doc.lcd, { x: doc.lcd.x + 240, y: doc.lcd.y + 145 });
  for (const b of doc.breadboards)
    points.push(b, { x: b.x + 524, y: b.y + 354 });
  for (const part of doc.parts) {
    const p = partPosition(doc, part);
    points.push({ x: p.x - 35, y: p.y - 45 }, { x: p.x + 35, y: p.y + 35 });
  }
  for (const wire of doc.wires) if (wire.via && wire.routeY === undefined) points.push(...wire.via);
  for (const wire of doc.wires)
    if (wire.routeY !== undefined)
      points.push({ x: doc.uno.x, y: wire.routeY });
  const left = Math.min(...points.map((p) => p.x)),
    right = Math.max(...points.map((p) => p.x)),
    top = Math.min(...points.map((p) => p.y)),
    bottom = Math.max(...points.map((p) => p.y));
  // 100% is one world unit per CSS pixel, even on a 4K screen. Never auto-enlarge.
  const zoom = Math.max(
    MIN_ZOOM,
    Math.min(
      1,
      (size.width - 96) / Math.max(1, right - left),
      (size.height - 120) / Math.max(1, bottom - top),
    ),
  );
  return {
    x: (left + right) / 2 - size.width / 2 / zoom,
    y: (top + bottom) / 2 - size.height / 2 / zoom,
    zoom,
  };
}
