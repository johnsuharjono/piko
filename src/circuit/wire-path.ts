import type { Point } from "./model";
// Round orthogonal corners without changing endpoints or electrical connectivity.
export function roundedPath(points: Point[], radius = 9): string {
  const clean = points.filter(
    (p, i) => !i || p.x !== points[i - 1].x || p.y !== points[i - 1].y,
  );
  if (!clean.length) return "";
  let path = `M${clean[0].x} ${clean[0].y}`;
  for (let i = 1; i < clean.length - 1; i++) {
    const a = clean[i - 1],
      b = clean[i],
      c = clean[i + 1],
      ab = Math.hypot(b.x - a.x, b.y - a.y),
      bc = Math.hypot(c.x - b.x, c.y - b.y),
      r = Math.min(radius, ab / 2, bc / 2);
    if (!ab || !bc) continue;
    const before = {
        x: b.x + ((a.x - b.x) * r) / ab,
        y: b.y + ((a.y - b.y) * r) / ab,
      },
      after = {
        x: b.x + ((c.x - b.x) * r) / bc,
        y: b.y + ((c.y - b.y) * r) / bc,
      };
    path += ` L${before.x} ${before.y} Q${b.x} ${b.y} ${after.x} ${after.y}`;
  }
  const last = clean.at(-1)!;
  return path + ` L${last.x} ${last.y}`;
}
