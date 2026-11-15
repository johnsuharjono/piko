import {
  COMPONENTS,
  COMPONENT_ROWS,
  BREADBOARD_ROW_Y,
  LCD_PIN_NAMES,
} from "./components";
import type { Pin } from "../simulation/machine";
export type Point = { x: number; y: number };
// A generous finite storage limit keeps corrupt documents bounded without limiting a screen-sized bench.
export const WORLD_LIMIT = 100000;
export function boundedPoint(point: Point): Point {
  return {
    x: Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, point.x)),
    y: Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, point.y)),
  };
}
export const ROWS = COMPONENT_ROWS;
export type Row = (typeof ROWS)[number];
export type Breadboard = Point & { id: string };
export type Part = Point & {
  id: string;
  kind: "led" | "resistor" | "button" | "switch";
  label?: string;
  ledColor?: "red" | "amber" | "green";
  rotation: 0 | 90 | 180 | 270;
  flipped: boolean;
  resistance: number;
  mounts: [string | null, string | null];
};
export type Wire = {
  id: string;
  from: string;
  to: string;
  color: string;
  routeY?: number;
  via?: Point[];
};
export type CircuitDoc = {
  lcd?: Point;
  version: 1;
  uno: Point;
  breadboards: Breadboard[];
  parts: Part[];
  wires: Wire[];
};
export const COLORS = [
  "#e5a16f",
  "#83b99a",
  "#78a9cc",
  "#c28fc0",
  "#d8c77c",
  "#aeb9b6",
];
export const holeId = (board: string, row: Row, column: number) =>
  `bb:${board}:${row}:${column}`;
const rowY = BREADBOARD_ROW_Y;
export function holePosition(
  board: Breadboard,
  row: Row,
  column: number,
): Point {
  return { x: board.x + 30 + (column - 1) * 16, y: board.y + rowY[row] };
}
export function allHoles(doc: CircuitDoc) {
  return doc.breadboards.flatMap((board) =>
    ROWS.flatMap((row) =>
      Array.from({ length: 30 }, (_, i) => ({
        id: holeId(board.id, row, i + 1),
        ...holePosition(board, row, i + 1),
        label: `Breadboard ${row}${i + 1}`,
      })),
    ),
  );
}
export function rotate(point: Point, angle: number): Point {
  const r = (angle * Math.PI) / 180;
  return {
    x: Math.round(point.x * Math.cos(r) - point.y * Math.sin(r)),
    y: Math.round(point.x * Math.sin(r) + point.y * Math.cos(r)),
  };
}
export function leadOffset(part: Part, index: number): Point {
  return rotate(COMPONENTS[part.kind].pins[index], part.rotation);
}
export function partPosition(doc: CircuitDoc, part: Part): Point {
  if (part.mounts[0]) {
    const hole = allHoles(doc).find((h) => h.id === part.mounts[0]);
    if (hole) {
      const offset = leadOffset(part, 0);
      return { x: hole.x - offset.x, y: hole.y - offset.y };
    }
  }
  return { x: part.x, y: part.y };
}
export const LCD_PINS = LCD_PIN_NAMES;
export function terminals(doc: CircuitDoc) {
  const uno = COMPONENTS.uno.pins.map((pin) => ({
    ...pin,
    id: `uno:${pin.id}`,
    x: doc.uno.x + pin.x,
    y: doc.uno.y + pin.y,
  }));
  return [
    ...uno,
    ...(doc.lcd
      ? COMPONENTS.lcd.pins.map((pin) => ({
          ...pin,
          id: `lcd:${pin.id}`,
          x: doc.lcd!.x + pin.x,
          y: doc.lcd!.y + pin.y,
        }))
      : []),
    ...allHoles(doc),
    ...doc.parts.flatMap((part) =>
      [0, 1].map((index) => {
        const center = partPosition(doc, part),
          offset = leadOffset(part, index);
        return {
          id: `${part.id}:${index}`,
          x: center.x + offset.x,
          y: center.y + offset.y,
          label: `${part.id} ${part.kind !== "led" ? `contact ${index + 1}` : index === (part.flipped ? 1 : 0) ? "anode (+)" : "cathode (−)"}`,
        };
      }),
    ),
  ];
}
export function mountPart(doc: CircuitDoc, part: Part): Part {
  const holes = allHoles(doc),
    occupied = new Set(
      doc.parts
        .filter((p) => p.id !== part.id)
        .flatMap((p) => p.mounts)
        .filter(Boolean),
    );
  const mounts = ([0, 1] as const).map((index) => {
    const off = leadOffset(part, index);
    return holes
      .filter((h) => !occupied.has(h.id))
      .map((h) => ({
        h,
        d: Math.hypot(h.x - part.x - off.x, h.y - part.y - off.y),
      }))
      .sort((a, b) => a.d - b.d)[0];
  });
  // Both leads must fit distinct, unoccupied holes. Otherwise the part stays off-board.
  if (mounts.every((m) => m && m.d <= 9) && mounts[0].h.id !== mounts[1].h.id) {
    const a = mounts[0].h,
      b = mounts[1].h,
      offA = leadOffset(part, 0),
      offB = leadOffset(part, 1);
    if (
      Math.hypot(b.x - a.x - (offB.x - offA.x), b.y - a.y - (offB.y - offA.y)) <
      1
    )
      return {
        ...part,
        x: a.x - offA.x,
        y: a.y - offA.y,
        mounts: [a.id, b.id],
      };
  }
  return { ...part, mounts: [null, null] };
}
export function starterCircuit(): CircuitDoc {
  const doc: CircuitDoc = {
    version: 1,
    uno: { x: 30, y: 180 },
    breadboards: [{ id: "BB1", x: 400, y: 130 }],
    parts: [],
    wires: [],
  };
  const h = (r: Row, c: number) => holeId("BB1", r, c);
  doc.parts = [
    {
      id: "R1",
      kind: "resistor",
      x: 518,
      y: 220,
      rotation: 0,
      flipped: false,
      resistance: 330,
      mounts: [h("B", 5), h("B", 8)],
    },
    {
      id: "LED1",
      kind: "led",
      x: 550,
      y: 234,
      rotation: 0,
      flipped: false,
      resistance: 330,
      mounts: [h("D", 8), h("D", 9)],
    },
  ];
  doc.wires = [
    { id: "W1", from: "uno:D13", to: h("A", 5), color: COLORS[0], routeY: 105 },
    {
      id: "W2",
      from: h("E", 9),
      to: h("TN", 9),
      color: COLORS[5],
      routeY: 420,
    },
    {
      id: "W3",
      from: "uno:GND",
      to: h("TN", 1),
      color: COLORS[5],
      routeY: 520,
    },
  ];
  return doc;
}

class Nets {
  private parents = new Map<string, string>();
  find(key: string): string {
    const parent = this.parents.get(key);
    if (!parent) {
      this.parents.set(key, key);
      return key;
    }
    if (parent === key) return key;
    const root = this.find(parent);
    this.parents.set(key, root);
    return root;
  }
  join(a: string, b: string) {
    this.parents.set(this.find(a), this.find(b));
  }
}
export type LedBranch = {
  id: string;
  status:
    | "ready"
    | "open"
    | "reversed"
    | "missing-resistor"
    | "unsupported"
    | "bypassed";
  message: string;
  source?: number | "5V";
  resistors: string[];
};
export type CircuitAnalysis = {
  leds: LedBranch[];
  errors: string[];
  inputs: Record<number, boolean | null>;
  netOf: (id: string) => string;
  connected: (a: string, b: string) => boolean;
};
export function analyzeCircuit(
  doc: CircuitDoc,
  controls: Record<string, boolean> = {},
): CircuitAnalysis {
  const nets = new Nets(),
    ends = terminals(doc),
    ids = new Set(ends.map((t) => t.id)),
    errors: string[] = [];
  for (const board of doc.breadboards)
    for (const row of ROWS)
      for (let c = 1; c <= 30; c++) {
        const group =
          row === "TP" || row === "TN" || row === "BP" || row === "BN"
            ? `${board.id}:rail:${row}:${c <= 15 ? 0 : 1}`
            : `${board.id}:strip:${c}:${"ABCDE".includes(row) ? 0 : 1}`;
        nets.join(holeId(board.id, row, c), group);
      }
  for (const part of doc.parts)
    part.mounts.forEach((hole, index) => {
      if (hole && ids.has(hole)) nets.join(`${part.id}:${index}`, hole);
    });
  for (const wire of doc.wires)
    if (ids.has(wire.from) && ids.has(wire.to)) nets.join(wire.from, wire.to);
  // Contacts are ideal open/closed switches. Identify GPIO-to-ground input branches
  // before closing contacts so input pins are never mistaken for power sources.
  const contacts = doc.parts.filter(
    (p) => p.kind === "button" || p.kind === "switch",
  );
  const inputPins = new Set<number>();
  const baseGround = nets.find("uno:GND");
  for (const contact of contacts) {
    const a = nets.find(`${contact.id}:0`),
      b = nets.find(`${contact.id}:1`);
    if (a === b) continue;
    for (let pin = 0; pin < 20; pin++) {
      const n = nets.find(`uno:D${pin}`);
      if ((a === baseGround && b === n) || (b === baseGround && a === n))
        inputPins.add(pin);
    }
  }
  for (const contact of contacts)
    if (controls[contact.id]) nets.join(`${contact.id}:0`, `${contact.id}:1`);
  const ground = nets.find("uno:GND");
  const sources = [
    { net: nets.find("uno:5V"), pin: "5V" as number | "5V" },
    ...Array.from({ length: 20 }, (_, pin) => ({
      net: nets.find(`uno:D${pin}`),
      pin,
    })).filter((source) => !inputPins.has(source.pin)),
  ];
  for (const source of sources)
    if (source.net === ground)
      errors.push(
        `${source.pin === "5V" ? "5V" : `D${source.pin}`} is wired directly to GND. Remove the short before running.`,
      );
  for (let i = 0; i < sources.length; i++)
    for (let j = i + 1; j < sources.length; j++)
      if (sources[i].net === sources[j].net)
        errors.push(
          "Two power/output pins are joined directly. Give each output its own net before running.",
        );
  type Edge = { to: string; id: string; resistance: number };
  const graph = new Map<string, Edge[]>();
  const add = (a: string, b: string, part: Part) =>
    graph.set(a, [
      ...(graph.get(a) || []),
      { to: b, id: part.id, resistance: part.resistance },
    ]);
  for (const part of doc.parts.filter((p) => p.kind === "resistor")) {
    const a = nets.find(`${part.id}:0`),
      b = nets.find(`${part.id}:1`);
    if (a !== b) {
      add(a, b, part);
      add(b, a, part);
    }
  }
  function region(start: string) {
    const reached = new Map<string, Edge[]>(),
      visitedEdges = new Set<string>(),
      todo: [string, Edge[]][] = [[start, []]];
    while (todo.length) {
      const [node, path] = todo.shift()!;
      if (reached.has(node)) continue;
      reached.set(node, path);
      for (const edge of graph.get(node) || []) {
        visitedEdges.add(edge.id);
        if (!reached.has(edge.to)) todo.push([edge.to, [...path, edge]]);
      }
    }
    return { reached, cycle: visitedEdges.size >= reached.size };
  }
  const leds = doc.parts
    .filter((p) => p.kind === "led")
    .map((part): LedBranch => {
      const a = nets.find(`${part.id}:${part.flipped ? 1 : 0}`),
        k = nets.find(`${part.id}:${part.flipped ? 0 : 1}`);
      const base = { id: part.id, resistors: [] as string[] };
      if (a === k)
        return {
          ...base,
          status: "bypassed",
          message: `${part.id}: both legs share the same breadboard strip or wire. Put them on separate nets.`,
        };
      const ar = region(a),
        kr = region(k),
        aSources = sources.filter((s) => ar.reached.has(s.net)),
        kSources = sources.filter((s) => kr.reached.has(s.net));
      if (
        ar.reached.has(k) ||
        ar.cycle ||
        kr.cycle ||
        aSources.length > 1 ||
        kSources.length > 1 ||
        (aSources.length && ar.reached.has(ground)) ||
        (kSources.length && kr.reached.has(ground))
      )
        return {
          ...base,
          status: "unsupported",
          message: `${part.id}: this resistor network is outside the supported series LED branches. Use one output → resistor → LED → GND.`,
        };
      if (kSources.length === 1 && ar.reached.has(ground))
        return {
          ...base,
          status: "reversed",
          message: `${part.id} is reversed. Flip its polarity so the anode (+) faces the output and cathode (−) faces GND.`,
        };
      if (aSources.length !== 1 || !kr.reached.has(ground))
        return {
          ...base,
          status: "open",
          message: `${part.id} has an open circuit. Connect its anode through a resistor to an output, and its cathode to GND.`,
        };
      const path = [
        ...ar.reached.get(aSources[0].net)!,
        ...kr.reached.get(ground)!,
      ];
      if (!path.length)
        return {
          ...base,
          status: "missing-resistor",
          message: `${part.id} has no series resistor. Add a 220 Ω–1 kΩ resistor; this LED is held off.`,
        };
      if (path.some((e) => e.resistance < 220 || e.resistance > 1000))
        return {
          ...base,
          status: "unsupported",
          message: `${part.id}: use resistors between 220 Ω and 1 kΩ for this digital bench.`,
        };
      return {
        ...base,
        status: "ready",
        source: aSources[0].pin,
        resistors: path.map((e) => e.id),
        message: `${part.id}: ${aSources[0].pin === "5V" ? "5V" : `D${aSources[0].pin}`} → ${path.map((e) => e.id).join(" + ")} → LED → GND.`,
      };
    });
  const shared = new Set(
    leds
      .filter((led) => led.status === "ready")
      .flatMap((led) =>
        led.resistors.filter((id) =>
          leds.some(
            (other) =>
              other.id !== led.id &&
              other.status === "ready" &&
              other.resistors.includes(id),
          ),
        ),
      ),
  );
  for (const led of leds)
    if (led.status === "ready" && led.resistors.some((id) => shared.has(id))) {
      led.status = "unsupported";
      led.message = `${led.id}: sharing a limiting resistor between LEDs is unsupported. Give each LED its own resistor.`;
    }
  return {
    leds,
    inputs: Object.fromEntries(
      [...inputPins].map((pin) => [
        pin,
        nets.find(`uno:D${pin}`) === ground
          ? false
          : nets.find(`uno:D${pin}`) === nets.find("uno:5V")
            ? true
            : null,
      ]),
    ),
    errors: [...new Set(errors)],
    netOf: (id) => nets.find(id),
    connected: (a, b) => nets.find(a) === nets.find(b),
  };
}
export function ledIsOn(
  branch: LedBranch,
  pins: Pin[],
  blocked = false,
): boolean {
  if (blocked || branch.status !== "ready") return false;
  if (branch.source === "5V") return true;
  const pin = pins[branch.source!];
  return !!pin && pin.mode === "OUTPUT" && pin.high;
}

export function parseCircuit(value: unknown): CircuitDoc | null {
  // Saved documents are bounded and checked before they can create SVG or graph objects.
  if (!value || typeof value !== "object") return null;
  const d = value as CircuitDoc;
  const point = (p: Point) =>
    p &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    Math.abs(p.x) <= WORLD_LIMIT &&
    Math.abs(p.y) <= WORLD_LIMIT;
  if (
    d.version !== 1 ||
    !point(d.uno) ||
    (d.lcd !== undefined && !point(d.lcd)) ||
    !Array.isArray(d.breadboards) ||
    d.breadboards.length > 1 ||
    !Array.isArray(d.parts) ||
    d.parts.length > 12 ||
    !Array.isArray(d.wires) ||
    d.wires.length > 64
  )
    return null;
  const identity = (id: string) =>
    typeof id === "string" && /^[A-Za-z][A-Za-z0-9]{0,15}$/.test(id);
  if (d.breadboards.some((b) => !point(b) || !identity(b.id))) return null;
  if (
    d.parts.some(
      (p) =>
        !point(p) ||
        !identity(p.id) ||
        (p.label !== undefined &&
          (typeof p.label !== "string" || p.label.length > 24)) ||
        !["led", "resistor", "button", "switch"].includes(p.kind) ||
        (p.ledColor !== undefined &&
          !["red", "amber", "green"].includes(p.ledColor)) ||
        ![0, 90, 180, 270].includes(p.rotation) ||
        typeof p.flipped !== "boolean" ||
        ![220, 330, 470, 1000].includes(p.resistance) ||
        !Array.isArray(p.mounts) ||
        p.mounts.length !== 2,
    )
  )
    return null;
  if (
    new Set([...d.breadboards, ...d.parts].map((p) => p.id)).size !==
    d.breadboards.length + d.parts.length
  )
    return null;
  const holes = new Set(allHoles(d).map((h) => h.id));
  const occupied = new Set<string>();
  for (const p of d.parts)
    for (const mount of p.mounts)
      if (mount !== null) {
        if (
          typeof mount !== "string" ||
          !holes.has(mount) ||
          occupied.has(mount)
        )
          return null;
        occupied.add(mount);
      }
  const ids = new Set(terminals(d).map((t) => t.id));
  if (
    d.wires.some(
      (w) =>
        !identity(w.id) ||
        !ids.has(w.from) ||
        !ids.has(w.to) ||
        w.from === w.to ||
        !COLORS.includes(w.color) ||
        (w.via !== undefined &&
          (!Array.isArray(w.via) ||
            w.via.length > 8 ||
            w.via.some((p) => !point(p)))) ||
        (w.routeY !== undefined &&
          (!Number.isFinite(w.routeY) || Math.abs(w.routeY) > WORLD_LIMIT)),
    )
  )
    return null;
  if (new Set(d.wires.map((w) => w.id)).size !== d.wires.length) return null;
  return structuredClone(d);
}

export function lcdConnections(doc: CircuitDoc) {
  if (!doc.lcd) return null;
  const net = analyzeCircuit(doc);
  if (
    !net.connected("lcd:GND", "uno:GND") ||
    !net.connected("lcd:RW", "uno:GND") ||
    !net.connected("lcd:5V", "uno:5V")
  )
    return null;
  const pin = (name: string) =>
    Array.from({ length: 20 }, (_, i) => i).filter((i) =>
      net.connected(`lcd:${name}`, `uno:D${i}`),
    );
  const names = ["RS", "E", "D4", "D5", "D6", "D7"].map(pin);
  if (names.some((p) => p.length !== 1)) return null;
  const values = names.map((p) => p[0]);
  if (new Set(values).size !== 6) return null;
  return { rs: values[0], enable: values[1], data: values.slice(2) };
}
