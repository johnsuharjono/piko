import { createPortal } from "react-dom";
import {
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  CornerUpLeft,
  Plus,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
  Unplug,
  X,
  Minus,
  Scan,
  Grid2X2,
  PanelRight,
} from "lucide-react";
import { Button } from "./ui/button";
import { Picker } from "./picker";
import { ComponentThumbnail } from "./component-thumbnail";
import { PALETTE, type PaletteKind } from "../circuit/palette";
import {
  zoomView,
  fitView,
  resizedView,
  DEFAULT_VIEWPORT,
  MIN_ZOOM,
  MAX_ZOOM,
  type ViewportSize,
} from "../circuit/viewport";
import { roundedPath } from "../circuit/wire-path";
import {
  COLORS,
  boundedPoint,
  WORLD_LIMIT,
  ROWS,
  holeId,
  holePosition,
  leadOffset,
  ledIsOn,
  mountPart,
  partPosition,
  starterCircuit,
  terminals,
  type CircuitAnalysis,
  type CircuitDoc,
  type Part,
  type Point,
} from "../circuit/model";
import type { Pin } from "../simulation/machine";
export type ComponentName =
  "board" | "breadboard" | "resistor" | "led" | "button" | "switch";
type Selection = {
  kind: "part" | "wire" | "breadboard" | "uno" | "lcd";
  id: string;
} | null;
type Drag = {
  kind: "part" | "breadboard" | "uno" | "route" | "lcd";
  id: string;
  start: Point;
  origin: Point;
  at: Point;
};
type Props = {
  doc: CircuitDoc;
  onChange: (doc: CircuitDoc) => void;
  onSelectionChange?: () => void;
  highlight?: string | null;
  propertiesHidden?: boolean;
  pins: Pin[];
  lcdLines?: string[];
  externalTray?: boolean;
  trayTarget?: HTMLElement | null;
  onToggleTray?: () => void;
  selected: number;
  onPin: (pin: number) => void;
  onComponent: (name: ComponentName) => void;
  analysis: CircuitAnalysis;
  onUndo: () => void;
  onRedo: () => void;
  onRestore: () => void;
  canUndo: boolean;
  canRedo: boolean;
  interactive?: boolean;
  editingLocked?: boolean;
  controls?: Record<string, boolean>;
  onControlChange?: (id: string, active: boolean) => void;
};
export function Circuit({
  doc,
  onChange,
  onSelectionChange,
  highlight = null,
  propertiesHidden = false,
  pins,
  lcdLines,
  externalTray = false,
  trayTarget = null,
  onToggleTray,
  selected,
  onPin,
  onComponent,
  analysis,
  onUndo,
  onRedo,
  onRestore,
  canUndo,
  canRedo,
  interactive = true,
  editingLocked = false,
  controls = {},
  onControlChange = () => {},
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const ink = (color: string) =>
    ({
      [COLORS[0]]: "var(--wire-orange)",
      [COLORS[1]]: "var(--wire-green)",
      [COLORS[2]]: "var(--wire-blue)",
      [COLORS[3]]: "var(--wire-purple)",
      [COLORS[4]]: "var(--wire-yellow)",
      [COLORS[5]]: "var(--wire-ground)",
    })[color] || color;
  const [search, setSearch] = useState("");
  const [placement, setPlacement] = useState<PaletteKind | null>(null);
  const [trayOpen, setTrayOpen] = useState(true);
  useEffect(() => {
    if (window.matchMedia?.("(max-width: 700px)").matches) setTrayOpen(false);
  }, []);
  const [selection, setSelection] = useState<Selection>(null),
    [pending, setPending] = useState<string | null>(null),
    [reconnect, setReconnect] = useState<{
      id: string;
      end: "from" | "to";
    } | null>(null);
  useEffect(() => {
    if (selection && !editingLocked) onSelectionChange?.();
  }, [selection, onSelectionChange, editingLocked]);
  const [color, setColor] = useState(COLORS[0]),
    [notice, setNotice] = useState(
      "Drag components onto the breadboard. Click two terminals to connect a wire.",
    ),
    [hover, setHover] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null),
    dragRef = useRef<Drag | null>(null),
    [cursor, setCursor] = useState<Point | null>(null);
  const [keyboardWiring, setKeyboardWiring] = useState(false),
    [from, setFrom] = useState("uno:D13"),
    [to, setTo] = useState("");
  const [activeHole, setActiveHole] = useState(""),
    [showStrips, setShowStrips] = useState(false);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [viewport, setViewport] = useState<ViewportSize>(DEFAULT_VIEWPORT);
  const sizeRef = useRef(DEFAULT_VIEWPORT),
    cameraReady = useRef(false);
  const [measured, setMeasured] = useState(false);
  useLayoutEffect(() => {
    const element = svg.current;
    if (!element) return;
    const measure = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      const next = { width, height },
        before = sizeRef.current;
      if (
        cameraReady.current &&
        width === before.width &&
        height === before.height
      )
        return;
      const first = !cameraReady.current;
      cameraReady.current = true;
      sizeRef.current = next;
      setViewport(next);
      setMeasured(true);
      setView((v) =>
        first ? fitView(doc, next) : resizedView(v, before, next),
      );
    };
    // Observe the HTML viewport: SVG ResizeObserver sizes describe drawing bounds,
    // which need not change when its CSS viewport changes.
    const container = element.parentElement || element;
    const rect = container.getBoundingClientRect();
    measure(rect.width, rect.height);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) measure(r.width, r.height);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!editingLocked) return;
    setPending(null);
    setReconnect(null);
    setPlacement(null);
    setKeyboardWiring(false);
    setSelection(null);
    dragRef.current = null;
    setDrag(null);
  }, [editingLocked]);
  const panDrag = useRef<{
    x: number;
    y: number;
    origin: typeof view;
    scale: number;
  } | null>(null);
  function zoomBy(amount: number) {
    setView((v) =>
      zoomView(v, amount > 0 ? 1.25 : 1 / 1.25, undefined, viewport),
    );
  }
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const anchor = point(event);
      setView((v) =>
        zoomView(v, Math.exp(-event.deltaY * 0.002), anchor, viewport),
      );
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [view, viewport]);
  function point(event: { clientX: number; clientY: number }): Point {
    const element = svg.current!;
    const matrix = element.getScreenCTM?.();
    if (matrix && element.createSVGPoint) {
      const p = element.createSVGPoint();
      p.x = event.clientX;
      p.y = event.clientY;
      const world = p.matrixTransform(matrix.inverse());
      return { x: world.x, y: world.y };
    }
    // Observe the HTML viewport: SVG ResizeObserver sizes describe drawing bounds,
    // which need not change when its CSS viewport changes.
    const container = element.parentElement || element;
    const rect = container.getBoundingClientRect();
    return {
      x:
        view.x +
        ((event.clientX - rect.left) * viewport.width) /
          (rect.width || viewport.width) /
          view.zoom,
      y:
        view.y +
        ((event.clientY - rect.top) * viewport.height) /
          (rect.height || viewport.height) /
          view.zoom,
    };
  }
  const cancelWire = () => {
    setPending(null);
    setReconnect(null);
    setCursor(null);
  };
  function commit(next: CircuitDoc) {
    if (editingLocked) return;
    onChange(next);
    cancelWire();
  }
  function dragDocument(d: Drag): CircuitDoc {
    if (d.kind === "part")
      return {
        ...doc,
        parts: doc.parts.map((p) =>
          p.id === d.id ? { ...p, ...d.at, mounts: [null, null] } : p,
        ),
      };
    if (d.kind === "breadboard")
      return {
        ...doc,
        breadboards: doc.breadboards.map((b) =>
          b.id === d.id ? { ...b, ...d.at } : b,
        ),
      };
    if (d.kind === "lcd") return { ...doc, lcd: d.at };
    if (d.kind === "uno") return { ...doc, uno: d.at };
    return {
      ...doc,
      wires: doc.wires.map((w) =>
        w.id === d.id ? { ...w, routeY: d.at.y } : w,
      ),
    };
  }
  const display = drag ? dragDocument(drag) : doc;
  const ends = useMemo(() => terminals(display), [display]);
  const endMap = new Map(ends.map((t) => [t.id, t]));
  const activeNet = hover || highlight;
  const chosenPart = doc.parts.find(
    (p) => selection?.kind === "part" && p.id === selection.id,
  );
  const chosenWire = doc.wires.find(
    (w) => selection?.kind === "wire" && w.id === selection.id,
  );
  const branch = analysis.leds.find((l) => l.id === chosenPart?.id);
  const validSelection =
    selection &&
    (selection.kind === "part"
      ? chosenPart
      : selection.kind === "wire"
        ? chosenWire
        : selection.kind === "lcd"
          ? !!doc.lcd
          : selection.kind === "breadboard"
            ? doc.breadboards.some((b) => b.id === selection.id)
            : true);
  function wire(a: string, b: string, editing = reconnect) {
    if (editingLocked) return;
    if (a === b) {
      setNotice("Choose a different terminal for the other end.");
      return;
    }
    if (!endMap.has(a) || !endMap.has(b)) {
      setNotice("Choose two existing terminals.");
      return;
    }
    const existing = doc.wires.find(
      (w) => (w.from === a && w.to === b) || (w.from === b && w.to === a),
    );
    if (existing && existing.id !== editing?.id) {
      setSelection({ kind: "wire", id: existing.id });
      cancelWire();
      setNotice(
        "These terminals already have a wire. Select it to reconnect or delete it.",
      );
      return;
    }
    if (editing) {
      const next = doc.wires.map((w) =>
        w.id === editing.id ? { ...w, [editing.end]: b } : w,
      );
      commit({ ...doc, wires: next });
      setNotice("Wire reconnected. Run your sketch to test the new circuit.");
      return;
    }
    if (doc.wires.length >= 64) {
      setNotice("This bench supports up to 64 wires. Remove a wire first.");
      cancelWire();
      return;
    }
    let number = 1;
    while (doc.wires.some((w) => w.id === `W${number}`)) number++;
    const id = `W${number}`;
    commit({ ...doc, wires: [...doc.wires, { id, from: a, to: b, color }] });
    setSelection({ kind: "wire", id });
    setNotice(
      `${id} connected. Wires join electrical nets; crossing wires do not connect.`,
    );
  }
  function terminal(id: string) {
    if (editingLocked) return;
    const match = id.match(/^uno:D(\d+)$/);
    if (match) onPin(Number(match[1]));
    if (pending) {
      wire(pending, id);
      return;
    }
    setSelection(null);
    setPending(id);
    setCursor(endMap.get(id) || null);
    setNotice(
      `Starting at ${endMap.get(id)?.label}. Choose the other terminal, or press Escape to cancel.`,
    );
  }
  function begin(
    event: PointerEvent<SVGElement>,
    kind: Drag["kind"],
    id: string,
    origin: Point,
  ) {
    if (editingLocked || event.button !== 0) return;
    event.stopPropagation();
    cancelWire();
    if (kind !== "route")
      setSelection({ kind: kind === "part" ? "part" : kind, id });
    const d = { kind, id, start: point(event), origin, at: origin };
    dragRef.current = d;
    setDrag(d);
    svg.current?.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    if (panDrag.current) {
      const p = panDrag.current;
      setView({
        ...p.origin,
        x: p.origin.x - (event.clientX - p.x) / p.scale,
        y: p.origin.y - (event.clientY - p.y) / p.scale,
      });
      return;
    }
    const p = point(event);
    setCursor(p);
    const d = dragRef.current;
    if (!d) return;
    const at = boundedPoint({
      x: d.origin.x + p.x - d.start.x,
      y: d.origin.y + p.y - d.start.y,
    });
    const next = { ...d, at };
    dragRef.current = next;
    setDrag(next);
  }
  function endDrag(event: PointerEvent<SVGSVGElement>) {
    panDrag.current = null;
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (svg.current?.hasPointerCapture(event.pointerId))
      svg.current.releasePointerCapture(event.pointerId);
    if (!d || Math.hypot(d.at.x - d.origin.x, d.at.y - d.origin.y) < 3) return;
    let next = dragDocument(d);
    if (d.kind === "part")
      next = {
        ...next,
        parts: next.parts.map((p) => (p.id === d.id ? mountPart(next, p) : p)),
      };
    commit(next);
    setNotice(
      d.kind === "part"
        ? "Component placed. Green lead rings mean it is plugged into the breadboard."
        : "Layout updated. Run to test your circuit.",
    );
  }
  function add(paletteKind: PaletteKind, at?: Point) {
    if (editingLocked) return;
    setPlacement(null);
    if (paletteKind === "lcd") {
      if (doc.lcd) {
        setSelection({ kind: "lcd", id: "lcd" });
        setNotice("One LCD is supported. Drag its body to move it.");
        return;
      }
      commit({ ...doc, lcd: boundedPoint(at || { x: 520, y: 170 }) });
      setSelection({ kind: "lcd", id: "lcd" });
      setPlacement(null);
      setNotice(
        "LCD added. Connect GND, 5V, RW to GND, and six GPIO signals. Try the LCD preset for matching code.",
      );
      return;
    }
    const kind =
      paletteKind === "led-amber" || paletteKind === "led-green"
        ? "led"
        : paletteKind;
    if (!at && (view.zoom !== 1 || view.x !== 0 || view.y !== 0)) {
      at = {
        x: view.x + viewport.width / 2 / view.zoom,
        y: view.y + viewport.height / 2 / view.zoom,
      };
    }
    if (kind === "breadboard") {
      if (doc.breadboards.length) {
        setSelection({ kind: "breadboard", id: doc.breadboards[0].id });
        setNotice("One breadboard is supported. Drag its border to move it.");
        return;
      }
      commit({
        ...doc,
        breadboards: [
          {
            id: "BB1",
            x: boundedPoint({ x: at?.x ?? 400, y: at?.y ?? 130 }).x,
            y: boundedPoint({ x: at?.x ?? 400, y: at?.y ?? 130 }).y,
          },
        ],
      });
      setSelection({ kind: "breadboard", id: "BB1" });
      return;
    }
    if (doc.parts.length >= 12) {
      setNotice("This bench supports up to 12 components. Remove one first.");
      return;
    }
    const prefix =
      kind === "led"
        ? "LED"
        : kind === "button"
          ? "BTN"
          : kind === "switch"
            ? "SW"
            : "R";
    let number = 1;
    while (doc.parts.some((p) => p.id === `${prefix}${number}`)) number++;
    const part: Part = {
      id: `${prefix}${number}`,
      kind,
      ...(kind === "led"
        ? {
            ledColor:
              paletteKind === "led-green"
                ? ("green" as const)
                : paletteKind === "led-amber"
                  ? ("amber" as const)
                  : ("red" as const),
          }
        : {}),
      x: boundedPoint({
        x: at?.x ?? (kind === "led" ? 730 : 600),
        y: at?.y ?? 75,
      }).x,
      y: boundedPoint({ x: at?.x ?? 600, y: at?.y ?? 75 }).y,
      rotation: 0,
      flipped: false,
      resistance: 330,
      mounts: [null, null],
    };
    commit({ ...doc, parts: [...doc.parts, mountPart(doc, part)] });
    setSelection({ kind: "part", id: part.id });
    setNotice(
      `${part.id} added. Drag it onto holes to plug in, or wire directly to its terminal rings. Arrow keys move a selected component.`,
    );
  }
  function deleteSelected() {
    if (editingLocked) return;
    if (!selection) return;
    if (selection.kind === "uno") {
      setNotice(
        "The Uno stays on this bench. You can move it or disconnect its wires.",
      );
      return;
    }
    let next = { ...doc };
    if (selection.kind === "lcd") {
      delete next.lcd;
      next.wires = doc.wires.filter(
        (w) => !w.from.startsWith("lcd:") && !w.to.startsWith("lcd:"),
      );
    }
    if (selection.kind === "wire")
      next.wires = doc.wires.filter((w) => w.id !== selection.id);
    if (selection.kind === "part") {
      next.parts = doc.parts.filter((p) => p.id !== selection.id);
      next.wires = doc.wires.filter(
        (w) =>
          !w.from.startsWith(selection.id + ":") &&
          !w.to.startsWith(selection.id + ":"),
      );
    }
    if (selection.kind === "breadboard") {
      next.parts = doc.parts.map((p) => ({
        ...p,
        ...partPosition(doc, p),
        mounts: [null, null],
      }));
      next.breadboards = [];
      next.wires = doc.wires.filter(
        (w) => !w.from.startsWith("bb:") && !w.to.startsWith("bb:"),
      );
    }
    commit(next);
    setSelection(null);
    setNotice("Removed. Use Undo to bring it back.");
  }
  function partChange(part: Part) {
    const next = {
      ...doc,
      parts: doc.parts.map((p) =>
        p.id === part.id ? mountPart(doc, part) : p,
      ),
    };
    commit(next);
  }
  function keyLayout(
    event: KeyboardEvent<SVGElement>,
    kind: "uno" | "breadboard" | "lcd",
    id: string,
    at: Point,
  ) {
    if (editingLocked) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelection({ kind, id });
      return;
    }
    const delta: Record<string, Point> = {
      ArrowLeft: { x: -16, y: 0 },
      ArrowRight: { x: 16, y: 0 },
      ArrowUp: { x: 0, y: -16 },
      ArrowDown: { x: 0, y: 16 },
    };
    if (!delta[event.key]) return;
    event.preventDefault();
    setSelection({ kind, id });
    const point = boundedPoint({
      x: at.x + delta[event.key].x,
      y: at.y + delta[event.key].y,
    });
    commit(
      kind === "lcd"
        ? { ...doc, lcd: point }
        : kind === "uno"
          ? { ...doc, uno: point }
          : {
              ...doc,
              breadboards: doc.breadboards.map((b) =>
                b.id === id ? { ...b, ...point } : b,
              ),
            },
    );
  }
  function rotatePart(part: Part) {
    const center = partPosition(doc, part),
      before = leadOffset(part, 0);
    const rotated = {
      ...part,
      rotation: ((part.rotation + 90) % 360) as Part["rotation"],
    };
    const after = leadOffset(rotated, 0);
    partChange({
      ...rotated,
      x: center.x + before.x - after.x,
      y: center.y + before.y - after.y,
      mounts: [null, null],
    });
  }
  function keyPart(event: KeyboardEvent<SVGGElement>, part: Part) {
    if (editingLocked) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelection({ kind: "part", id: part.id });
      return;
    }
    const delta: Record<string, Point> = {
      ArrowLeft: { x: -16, y: 0 },
      ArrowRight: { x: 16, y: 0 },
      ArrowUp: { x: 0, y: -16 },
      ArrowDown: { x: 0, y: 16 },
    };
    if (delta[event.key]) {
      event.preventDefault();
      const at = partPosition(doc, part);
      partChange({
        ...part,
        x: boundedPoint({
          x: at.x + delta[event.key].x,
          y: at.y + delta[event.key].y,
        }).x,
        y: boundedPoint({
          x: at.x + delta[event.key].x,
          y: at.y + delta[event.key].y,
        }).y,
        mounts: [null, null],
      });
    }
  }
  function holeKey(
    event: KeyboardEvent<SVGGElement>,
    board: string,
    row: (typeof ROWS)[number],
    col: number,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      terminal(holeId(board, row, col));
      return;
    }
    let r = ROWS.indexOf(row),
      c = col;
    if (event.key === "ArrowLeft") c--;
    else if (event.key === "ArrowRight") c++;
    else if (event.key === "ArrowUp") r--;
    else if (event.key === "ArrowDown") r++;
    else return;
    event.preventDefault();
    const id = holeId(
      board,
      ROWS[Math.max(0, Math.min(ROWS.length - 1, r))],
      Math.max(1, Math.min(30, c)),
    );
    setActiveHole(id);
    svg.current?.querySelector<SVGGElement>(`[data-terminal="${id}"]`)?.focus();
  }
  const terminalNode = (
    id: string,
    at: Point,
    label: string,
    hole = false,
    keyHandler?: (event: KeyboardEvent<SVGGElement>) => void,
  ) => (
    <g
      key={id}
      data-terminal={id}
      aria-description={highlight === id ? "Highlighted by guide" : undefined}
      role="button"
      aria-disabled={editingLocked}
      tabIndex={
        editingLocked
          ? -1
          : hole
            ? activeHole === id || (!activeHole && id.endsWith(":A:1"))
              ? 0
              : -1
            : 0
      }
      aria-label={label}
      className="editable-terminal"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        terminal(id);
        if (hole) setActiveHole(id);
      }}
      onPointerEnter={() => setHover(id)}
      onPointerLeave={() => setHover(null)}
      onKeyDown={
        keyHandler ||
        ((e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            terminal(id);
          }
        })
      }
    >
      <title>{label}</title>
      {highlight === id && (
        <circle
          cx={at.x}
          cy={at.y}
          r="14"
          fill="#f5bc6c33"
          stroke="#d38b32"
          strokeWidth="2"
          pointerEvents="none"
        />
      )}
      <circle cx={at.x} cy={at.y} r={hole ? 7 : 9} fill="transparent" />
      <circle
        cx={at.x}
        cy={at.y}
        r={hole ? 3 : 4.5}
        fill={
          pending === id
            ? "#f5be86"
            : activeNet && analysis.connected(activeNet, id)
              ? "#bcaa7c"
              : hole
                ? "#606b73"
                : "#141d1e"
        }
        stroke={
          pending === id
            ? "#fff1c3"
            : activeNet && analysis.connected(activeNet, id)
              ? "#f0bb82"
              : hole
                ? "#abb3bb"
                : "#c7b67e"
        }
        strokeWidth={pending === id ? 2 : 1}
      />
    </g>
  );
  const selectedLabel =
    (selection?.kind === "lcd" && doc.lcd ? "LCD 16×2" : null) ||
    chosenPart?.id ||
    chosenWire?.id ||
    (validSelection && selection?.kind === "breadboard"
      ? "Breadboard"
      : validSelection
        ? "Uno R3"
        : "Build your circuit");
  return (
    <div
      className="circuit-builder"
      data-tray-open={externalTray ? false : trayOpen}
      data-external-tray={externalTray}
      data-simulation-active={interactive}
      data-editing-locked={editingLocked}
      data-wiring-active={!!pending || !!chosenWire}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          cancelWire();
          setPlacement(null);
          setSelection(null);
        }
        if (
          !editingLocked &&
          (event.key === "Delete" || event.key === "Backspace") &&
          (event.target as HTMLElement).closest("svg")
        ) {
          event.preventDefault();
          deleteSelected();
        }
      }}
    >
      {externalTray ? (
        trayTarget ? (
          createPortal(
            <div className="component-tray" aria-label="Component tray">
              <div className="tray-heading">
                Parts<span>Uno compatible</span>
              </div>
              <input
                className="part-search"
                aria-label="Search parts"
                placeholder="Search parts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {PALETTE.filter((item) =>
                item.label.toLowerCase().includes(search.toLowerCase()),
              ).map((item) => (
                <button
                  key={item.kind}
                  data-component={item.kind}
                  aria-pressed={placement === item.kind}
                  title={
                    editingLocked
                      ? "Stop simulation to edit components"
                      : `Drag ${item.label.toLowerCase()} onto the canvas`
                  }
                  disabled={editingLocked}
                  draggable={!editingLocked}
                  onDragStart={(e) => {
                    setPlacement(item.kind);
                    e.dataTransfer.setData(
                      "application/x-piko-component",
                      item.kind,
                    );
                  }}
                  onDragEnd={() => setPlacement(null)}
                  onClick={() => {
                    setPlacement(item.kind);
                    svg.current?.focus();
                  }}
                >
                  <ComponentThumbnail kind={item.kind} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>,
            trayTarget,
          )
        ) : null
      ) : (
        <div className="component-tray" aria-label="Component tray">
          <div className="tray-heading">
            Parts<span>Uno compatible</span>
          </div>
          <input
            className="part-search"
            aria-label="Search parts"
            placeholder="Search parts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {PALETTE.filter((item) =>
            item.label.toLowerCase().includes(search.toLowerCase()),
          ).map((item) => (
            <button
              key={item.kind}
              data-component={item.kind}
              aria-pressed={placement === item.kind}
              title={
                editingLocked
                  ? "Stop simulation to edit components"
                  : `Drag ${item.label.toLowerCase()} onto the canvas`
              }
              disabled={editingLocked}
              draggable={!editingLocked}
              onDragStart={(e) => {
                setPlacement(item.kind);
                e.dataTransfer.setData(
                  "application/x-piko-component",
                  item.kind,
                );
              }}
              onDragEnd={() => setPlacement(null)}
              onClick={() => {
                setPlacement(item.kind);
                svg.current?.focus();
              }}
            >
              <ComponentThumbnail kind={item.kind} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
      <div className="wiring-tools">
        {!externalTray && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle components"
            title="Components"
            aria-pressed={trayOpen}
            onClick={() =>
              onToggleTray ? onToggleTray() : setTrayOpen(!trayOpen)
            }
          >
            <PanelRight size={16} />
          </Button>
        )}
        <div className="builder-history">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Undo circuit edit"
            disabled={editingLocked || !canUndo}
            onClick={() => {
              cancelWire();
              onUndo();
            }}
          >
            <Undo2 size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Redo circuit edit"
            disabled={editingLocked || !canRedo}
            onClick={() => {
              cancelWire();
              onRedo();
            }}
          >
            <Redo2 size={14} />
          </Button>
        </div>
        <label className="wire-colors" aria-label="Wire colors">
          {COLORS.map((c) => (
            <button
              key={c}
              disabled={editingLocked}
              aria-label={`Wire color ${c}`}
              aria-pressed={color === c}
              style={{ background: ink(c) }}
              onClick={() => {
                setColor(c);
                if (chosenWire)
                  commit({
                    ...doc,
                    wires: doc.wires.map((w) =>
                      w.id === chosenWire.id ? { ...w, color: c } : w,
                    ),
                  });
              }}
            />
          ))}
        </label>
        <button
          aria-pressed={showStrips}
          disabled={!doc.breadboards.length}
          title="Reveal the breadboard’s internal strips; this does not add wires"
          onClick={() => setShowStrips(!showStrips)}
        >
          <Grid2X2 size={15} /> Show breadboard strips
        </button>
        <button
          disabled={editingLocked}
          title="Choose two terminals to create a new wire"
          aria-expanded={keyboardWiring}
          onClick={() => setKeyboardWiring(!keyboardWiring)}
        >
          Add wire…
        </button>
      </div>
      {!editingLocked && keyboardWiring && (
        <div className="keyboard-wiring">
          <label>
            From
            <Picker
              label="Wire from terminal"
              value={from}
              onChange={setFrom}
              items={ends.map((t) => ({ value: t.id, label: t.label }))}
              placeholder="Choose terminal"
            />
          </label>
          <label>
            To
            <Picker
              label="Wire to terminal"
              value={to}
              onChange={setTo}
              items={ends.map((t) => ({ value: t.id, label: t.label }))}
              placeholder="Choose terminal"
            />
          </label>
          <Button
            size="sm"
            disabled={!from || !to}
            onClick={() => wire(from, to, null)}
          >
            Connect
          </Button>
        </div>
      )}
      <div className="breadboard-viewport">
        <svg
          ref={svg}
          className="breadboard-canvas"
          tabIndex={0}
          data-camera-ready={measured}
          viewBox={`${view.x} ${view.y} ${viewport.width / view.zoom} ${viewport.height / view.zoom}`}
          onKeyDown={(e) => {
            if (
              !editingLocked &&
              placement &&
              (e.key === "Enter" || e.key === " ")
            ) {
              e.preventDefault();
              add(placement, {
                x: view.x + viewport.width / 2 / view.zoom,
                y: view.y + viewport.height / 2 / view.zoom,
              });
            }
          }}
          onPointerDownCapture={(e) => {
            if (!editingLocked && placement) e.stopPropagation();
          }}
          onClickCapture={(e) => {
            if (!editingLocked && placement) {
              e.stopPropagation();
              add(placement, point(e));
            }
          }}
          aria-label={
            editingLocked
              ? "Simulating Arduino breadboard. Operate buttons and switches; stop simulation to edit wiring."
              : "Editable Arduino breadboard. Drag components, click two terminals to wire, or use Connect for keyboard wiring."
          }
          onPointerMove={move}
          onPointerUp={endDrag}
          onPointerCancel={() => {
            dragRef.current = null;
            panDrag.current = null;
            setDrag(null);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (editingLocked) return;
            const kind = e.dataTransfer.getData("application/x-piko-component");
            if (PALETTE.some((item) => item.kind === kind))
              add(kind as PaletteKind, point(e));
          }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelection(null);
              if (!pending && !placement && e.button === 0) {
                const matrix = svg.current?.getScreenCTM?.();
                panDrag.current = {
                  x: e.clientX,
                  y: e.clientY,
                  origin: view,
                  scale: matrix?.a || 1,
                };
                svg.current?.setPointerCapture(e.pointerId);
              }
            }
          }}
        >
          <defs>
            <pattern
              id="bench-grid"
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r=".65" fill="var(--grid)" />
            </pattern>
            <linearGradient id="uno-pcb" x2="1" y2="1">
              <stop stopColor="#317ba1" />
              <stop offset="1" stopColor="#24678c" />
            </linearGradient>
            <radialGradient id="led-glow">
              <stop stopColor="#ffc68c" stopOpacity=".6" />
              <stop offset="1" stopColor="#ed9458" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect
            x={view.x}
            y={view.y}
            width={viewport.width / view.zoom}
            height={viewport.height / view.zoom}
            fill="url(#bench-grid)"
            pointerEvents="none"
          />

          <g
            transform={`translate(${display.uno.x} ${display.uno.y})`}
            onPointerDown={(e) => begin(e, "uno", "uno", doc.uno)}
            className="movable-component"
            role="button"
            tabIndex={0}
            aria-label="Select Arduino Uno"
            onKeyDown={(e) => keyLayout(e, "uno", "uno", doc.uno)}
          >
            <rect
              width="300"
              height="240"
              rx="12"
              fill="url(#uno-pcb)"
              stroke={selection?.kind === "uno" ? "#ecc08b" : "#668b7c"}
              strokeWidth="2"
            />
            {[
              [13, 35],
              [285, 35],
              [13, 222],
              [285, 208],
            ].map(([x, y], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="5"
                stroke="#b3c4a6"
                strokeWidth="2"
                fill="#182725"
              />
            ))}
            <rect
              x="-10"
              y="75"
              width="42"
              height="43"
              rx="4"
              fill="#aab6ad"
              stroke="#ccd2bf"
            />
            <rect x="-10" y="83" width="11" height="27" fill="#3d4848" />
            <rect
              x="-6"
              y="182"
              width="40"
              height="29"
              rx="3"
              fill="#14201f"
              stroke="#8a9c87"
            />
            <text
              x="155"
              y="100"
              textAnchor="middle"
              fill="#d5e1ce"
              fontSize="30"
              fontWeight="650"
              letterSpacing="4"
            >
              UNO
            </text>
            <text
              x="155"
              y="119"
              textAnchor="middle"
              fill="#afc1aa"
              fontSize="9"
              letterSpacing="2"
            >
              ATMEGA328P · 16 MHz
            </text>
            <rect
              x="85"
              y="148"
              width="136"
              height="31"
              rx="3"
              fill="#111d1c"
              stroke="#7e9280"
            />
            {Array.from({ length: 14 }, (_, i) => (
              <path
                key={i}
                d={`M${91 + i * 9} 144v-7m0 46v7`}
                stroke="#a3b09a"
                strokeWidth="3"
              />
            ))}
            <text
              x="153"
              y="168"
              textAnchor="middle"
              fill="#a5b09a"
              fontSize="9"
            >
              ARDUINO UNO R3
            </text>
            <circle cx="251" cy="150" r="3" fill="#aac58d" />
            <text x="261" y="153" fill="#b7c5a6" fontSize="8">
              ON
            </text>
            <rect
              x="246"
              y="86"
              width="7"
              height="5"
              fill={
                pins[13].mode === "OUTPUT" && pins[13].high
                  ? "#ffd18a"
                  : "#66765b"
              }
            />
            <text x="261" y="92" fill="#b7c5a6" fontSize="8">
              L · D13
            </text>

          </g>
          {display.breadboards.map((board) => (
            <g key={board.id}>
              <rect
                x={board.x}
                y={board.y}
                width="524"
                height="354"
                rx="9"
                fill="#f9fafb"
                stroke={
                  selection?.kind === "breadboard" ? "#e8a66e" : "#838d7c"
                }
                strokeWidth="2"
                onPointerDown={(e) =>
                  begin(
                    e as unknown as PointerEvent<SVGGElement>,
                    "breadboard",
                    board.id,
                    doc.breadboards.find((b) => b.id === board.id)!,
                  )
                }
                className="movable-component"
                tabIndex={0}
                role="button"
                aria-label="Select breadboard"
                onKeyDown={(e) => keyLayout(e, "breadboard", board.id, board)}
              />
              <g pointerEvents="none">
                <rect
                  x={board.x + 12}
                  y={board.y + 171}
                  width="500"
                  height="14"
                  rx="3"
                  fill="#e5e8eb"
                />

                {[0, 1].map((half) => (
                  <g key={half}>
                    {[0, 1].map((side) => (
                      <g key={side}>
                        <path
                          d={`M${board.x + 21 + half * 248} ${board.y + (side ? 291 : 18)}h232`}
                          stroke="#b56457"
                          strokeWidth="1.5"
                        />
                        <path
                          d={`M${board.x + 21 + half * 248} ${board.y + (side ? 337 : 63)}h232`}
                          stroke="#607fa0"
                          strokeWidth="1.5"
                        />
                      </g>
                    ))}
                  </g>
                ))}
                <path
                  d={`M${board.x + 262} ${board.y + 17}v50m0 220v52`}
                  stroke="#7b8671"
                  strokeDasharray="2 3"
                />
                {["TP", "TN", "BP", "BN"].map((row) => (
                  <text
                    key={row}
                    x={board.x + 12}
                    y={holePosition(board, row as "TP", 1).y + 3}
                    textAnchor="middle"
                    fontSize="11"
                    fill={row.endsWith("P") ? "#a05448" : "#4c7198"}
                  >
                    {row.endsWith("P") ? "+" : "−"}
                  </text>
                ))}
                {ROWS.filter((r) => r.length === 1).map((row) => (
                  <text
                    key={row}
                    x={board.x + 12}
                    y={holePosition(board, row, 1).y + 3}
                    textAnchor="middle"
                    fill="#5e6c55"
                    fontSize="8"
                  >
                    {row.toLowerCase()}
                  </text>
                ))}
                {[1, 5, 10, 15, 16, 20, 25, 30].map((col) => (
                  <g key={col}>
                    <text
                      x={holePosition(board, "A", col).x}
                      y={board.y + 79}
                      textAnchor="middle"
                      fontSize="7"
                      fill="#637058"
                    >
                      {col}
                    </text>
                    <text
                      x={holePosition(board, "A", col).x}
                      y={board.y + 282}
                      textAnchor="middle"
                      fontSize="7"
                      fill="#637058"
                    >
                      {col}
                    </text>
                  </g>
                ))}
                {showStrips &&
                  Array.from({ length: 30 }, (_, i) => (
                    <g key={i}>
                      {["A", "F"].map((row) => (
                        <rect
                          key={row}
                          x={holePosition(board, row as "A", i + 1).x - 5}
                          y={holePosition(board, row as "A", i + 1).y - 6}
                          width="10"
                          height="76"
                          rx="4"
                          fill="#718b6c"
                          opacity=".35"
                        />
                      ))}
                    </g>
                  ))}
              </g>
            </g>
          ))}
          {display.lcd && (
            <g
              transform={`translate(${display.lcd.x} ${display.lcd.y})`}
              className="movable-component"
              onPointerDown={(e) => {
                if (!editingLocked) e.currentTarget.focus?.();
                begin(e, "lcd", "lcd", doc.lcd!);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!editingLocked) {
                  cancelWire();
                  setSelection({ kind: "lcd", id: "lcd" });
                }
              }}
              onKeyDown={(e) => keyLayout(e, "lcd", "lcd", doc.lcd!)}
              tabIndex={editingLocked ? -1 : 0}
              aria-pressed={selection?.kind === "lcd"}
              aria-disabled={editingLocked}
              role="button"
              aria-label={`16 by 2 LCD: ${(lcdLines || []).join(" ")}`}
            >
              {selection?.kind === "lcd" && !editingLocked && (
                <rect
                  x="-6"
                  y="-6"
                  width="252"
                  height="144"
                  rx="10"
                  fill="none"
                  stroke="#4391c0"
                  strokeWidth="2"
                  pointerEvents="none"
                />
              )}
              <rect
                width="240"
                height="132"
                rx="7"
                fill="#26785c"
                stroke="#17503d"
                strokeWidth="2"
              />
              <rect
                x="12"
                y="12"
                width="216"
                height="91"
                rx="4"
                fill="#172c29"
              />
              <rect
                x="21"
                y="22"
                width="198"
                height="68"
                rx="2"
                fill="#b8d678"
              />
              {[0, 1].map((row) => (
                <text
                  key={row}
                  x="29"
                  y={46 + row * 25}
                  fill="#263d26"
                  fontFamily="monospace"
                  fontSize="17"
                  letterSpacing="1"
                  xmlSpace="preserve"
                >
                  {(lcdLines?.[row] || " ".repeat(16)).padEnd(16)}
                </text>
              ))}
              <text x="12" y="110" fill="white" fontSize="8">
                LCD 1602 · 4-BIT
              </text>

            </g>
          )}
          {display.wires.map((w) => {
            const a = endMap.get(w.from),
              b = endMap.get(w.to);
            if (!a || !b) return null;
            const route = w.routeY ?? Math.min(a.y, b.y) - 28,
              path =
                w.via && w.routeY === undefined
                  ? roundedPath([a, ...w.via, b])
                  : a.x === b.x
                    ? `M${a.x} ${a.y} L${b.x} ${b.y}`
                    : roundedPath([
                        a,
                        { x: a.x, y: route },
                        { x: b.x, y: route },
                        b,
                      ]),
              isSelected = selection?.kind === "wire" && selection.id === w.id;
            return (
              <g
                key={w.id}
                role="button"
                tabIndex={editingLocked ? -1 : 0}
                aria-label={`Select wire ${w.id}: ${a.label} to ${b.label}`}
                className="editable-wire"
                aria-disabled={editingLocked}
                onClick={(e) => {
                  if (editingLocked) return;
                  e.stopPropagation();
                  cancelWire();
                  setSelection({ kind: "wire", id: w.id });
                }}
                onKeyDown={(e) => {
                  if (editingLocked) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    cancelWire();
                    setSelection({ kind: "wire", id: w.id });
                  }
                }}
              >
                <title>
                  {w.id}: {a.label} → {b.label}
                </title>
                <path
                  d={path}
                  fill="none"
                  stroke={isSelected ? "var(--primary)" : "var(--wire-outline)"}
                  strokeWidth={isSelected ? 5.5 : 4.5}
                  pointerEvents="none"
                />
                <path
                  d={path}
                  fill="none"
                  stroke={ink(w.color)}
                  strokeWidth="3"
                />
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="12"
                />
                {isSelected &&
                  a.x !== b.x &&
                  (!w.via || w.routeY !== undefined) && (
                    <circle
                      cx={(a.x + b.x) / 2}
                      cy={route}
                      r="6"
                      fill="#fff"
                      stroke="#5c89ad"
                      strokeWidth="2"
                      onPointerDown={(e) =>
                        begin(e, "route", w.id, {
                          x: (a.x + b.x) / 2,
                          y: route,
                        })
                      }
                    />
                  )}
              </g>
            );
          })}
          <g
            transform={`translate(${display.uno.x} ${display.uno.y})`}
            className="uno-pin-labels"
            pointerEvents="none"
          >
            {Array.from({ length: 14 }, (_, i) => (
              <text
                key={i}
                x={18 + i * 20}
                y="31"
                textAnchor="middle"
                fill={selected === 13 - i ? "#ffe0a8" : "#f4f8ff"}
                fontSize="9"
                fontWeight="600"
              >
                {13 - i}
              </text>
            ))}
            <text
              x="50"
              y="214"
              textAnchor="middle"
              fill="#f4f8ff"
              fontSize="9"
              fontWeight="600"
            >
              GND
            </text>
            <text
              x="90"
              y="214"
              textAnchor="middle"
              fill="#ffe0a8"
              fontSize="9"
              fontWeight="600"
            >
              5V
            </text>
            {Array.from({ length: 6 }, (_, i) => (
              <text
                key={i}
                x={168 + i * 20}
                y="214"
                textAnchor="middle"
                fill="#f4f8ff"
                fontSize="9"
                fontWeight="600"
              >
                A{i}
              </text>
            ))}
          </g>
          {ends
            .filter((t) => t.id.startsWith("lcd:"))
            .map((t) => (
              <g key={t.id}>
                {terminalNode(t.id, t, t.label)}
                <text
                  x={t.x}
                  y={t.y - 10}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#f1fff7"
                  stroke="#26785c"
                  strokeWidth="2.5"
                  paintOrder="stroke"
                  fontWeight="600"
                  pointerEvents="none"
                >
                  {t.id.slice(4)}
                </text>
              </g>
            ))}
          {ends
            .filter((t) => t.id.startsWith("uno:"))
            .map((t) => terminalNode(t.id, t, t.label))}
          {display.breadboards.flatMap((board) =>
            ROWS.flatMap((row) =>
              Array.from({ length: 30 }, (_, i) =>
                terminalNode(
                  holeId(board.id, row, i + 1),
                  holePosition(board, row, i + 1),
                  `Breadboard ${row}${i + 1}`,
                  true,
                  (e) => holeKey(e, board.id, row, i + 1),
                ),
              ),
            ),
          )}
          {display.parts.map((part) => {
            const at = partPosition(display, part),
              isSelected =
                selection?.kind === "part" && selection.id === part.id,
              lit = !!analysis.leds.find(
                (l) =>
                  l.id === part.id &&
                  ledIsOn(l, pins, !!analysis.errors.length),
              );
            return (
              <g
                key={part.id}
                className={`circuit-part ${isSelected ? "is-selected" : ""}`}
              >
                <g
                  transform={`translate(${at.x} ${at.y}) rotate(${part.rotation})`}
                  className="movable-component"
                  onPointerDown={(e) =>
                    begin(e, "part", part.id, partPosition(doc, part))
                  }
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${part.id}, ${part.kind}. Arrow keys move; Enter selects.`}
                  onKeyDown={(e) => keyPart(e, part)}
                >
                  {isSelected && (
                    <ellipse
                      cx="0"
                      cy={part.kind === "led" ? -3 : 0}
                      rx={part.kind === "led" ? 24 : 32}
                      ry={part.kind === "led" ? 30 : 15}
                      fill="#7aa9c216"
                      stroke="#7aa9c2"
                      strokeWidth="1.2"
                    />
                  )}
                  {part.kind === "resistor" ? (
                    <>
                      <path
                        d="M-24 0h13m22 0h13"
                        stroke="#8d9489"
                        strokeWidth="3"
                      />
                      <rect
                        x="-15"
                        y="-8"
                        width="30"
                        height="16"
                        rx="4"
                        fill="#c8b78c"
                        stroke="#8b7758"
                      />
                      <path
                        d="M-8-8v16m7-16v16"
                        stroke={
                          part.resistance === 330
                            ? "#cd7846"
                            : part.resistance === 220
                              ? "#b75444"
                              : "#a58e48"
                        }
                        strokeWidth="4"
                      />
                      <path d="M6-8v16" stroke="#60442b" strokeWidth="4" />
                    </>
                  ) : part.kind === "button" || part.kind === "switch" ? (
                    <>
                      <path d="M-16 0H16" stroke="#8c9aa3" strokeWidth="3" />
                      <rect
                        x="-13"
                        y="-15"
                        width="26"
                        height="30"
                        rx="4"
                        fill="#77858f"
                        stroke="#536573"
                      />
                      <g
                        className="interactive-control"
                        role="button"
                        tabIndex={0}
                        aria-label={
                          part.kind === "button"
                            ? `Press ${part.label || part.id}`
                            : `Toggle ${part.label || part.id}`
                        }
                        aria-pressed={!!controls[part.id]}
                        onPointerDown={(e) => {
                          if (!interactive) return;
                          e.stopPropagation();
                          cancelWire();
                          setSelection({ kind: "part", id: part.id });
                          if (part.kind === "button") {
                            e.currentTarget.setPointerCapture?.(e.pointerId);
                            onControlChange(part.id, true);
                          }
                        }}
                        onPointerUp={(e) => {
                          if (!interactive) return;
                          e.stopPropagation();
                          if (part.kind === "button")
                            onControlChange(part.id, false);
                        }}
                        onPointerCancel={() => {
                          if (part.kind === "button")
                            onControlChange(part.id, false);
                        }}
                        onClick={(e) => {
                          if (!interactive) return;
                          e.stopPropagation();
                          if (part.kind === "switch")
                            onControlChange(part.id, !controls[part.id]);
                        }}
                        onKeyDown={(e) => {
                          if (!interactive) return;
                          e.stopPropagation();
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            if (part.kind === "button")
                              onControlChange(part.id, true);
                            else if (!e.repeat)
                              onControlChange(part.id, !controls[part.id]);
                          }
                        }}
                        onKeyUp={(e) => {
                          e.stopPropagation();
                          if (
                            part.kind === "button" &&
                            (e.key === " " || e.key === "Enter")
                          ) {
                            e.preventDefault();
                            onControlChange(part.id, false);
                          }
                        }}
                        onBlur={() => {
                          if (part.kind === "button")
                            onControlChange(part.id, false);
                        }}
                      >
                        <rect
                          x="-13"
                          y="-15"
                          width="26"
                          height="30"
                          fill="transparent"
                        />
                        {part.kind === "button" ? (
                          <circle
                            r={controls[part.id] ? 8 : 10}
                            fill={controls[part.id] ? "#1b2d38" : "#384b58"}
                            stroke="#9ca8af"
                          />
                        ) : (
                          <>
                            <rect
                              x="-10"
                              y="-10"
                              width="20"
                              height="20"
                              rx="2"
                              fill="#263b48"
                            />
                            <rect
                              x="-8"
                              y={controls[part.id] ? -8 : 0}
                              width="16"
                              height="8"
                              rx="1"
                              fill={controls[part.id] ? "#91c8a4" : "#b1bac0"}
                            />
                          </>
                        )}
                      </g>
                    </>
                  ) : (
                    <>
                      {lit && (
                        <circle
                          cy="-7"
                          r="33"
                          fill="url(#led-glow)"
                          pointerEvents="none"
                        />
                      )}
                      <path
                        d="M-8 18V2m16 16V2"
                        stroke="#9ca58e"
                        strokeWidth="2"
                      />
                      <path
                        d="M-13 5v-15a13 13 0 0 1 26 0V5Z"
                        fill={
                          part.ledColor === "green"
                            ? lit
                              ? "#79d48f"
                              : "#3f8754"
                            : part.ledColor === "amber"
                              ? lit
                                ? "#ffd677"
                                : "#c99636"
                              : lit
                                ? "#ff725e"
                                : "#b64442"
                        }
                        stroke={lit ? "#ffd6c5" : "#8e3334"}
                        strokeWidth="1.5"
                      />
                      <rect
                        x="-16"
                        y="4"
                        width="32"
                        height="5"
                        rx="2"
                        fill={lit ? "#e35445" : "#963d3c"}
                      />
                      <path
                        d="M-7-11v10"
                        stroke={lit ? "#fff0cf" : "#b7805a"}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <text
                        x="-10"
                        y="31"
                        fill="#dca976"
                        fontSize="9"
                        textAnchor="middle"
                      >
                        {part.flipped ? "−" : "+"}
                      </text>
                      <text
                        x="10"
                        y="31"
                        fill="#dca976"
                        fontSize="9"
                        textAnchor="middle"
                      >
                        {part.flipped ? "+" : "−"}
                      </text>
                    </>
                  )}
                  <text
                    y={part.kind === "led" ? -43 : -25}
                    textAnchor="middle"
                    className="part-id"
                    style={{ fill: part.mounts[0] ? "#415368" : "var(--free-part-label)" }}
                  >
                    {part.label || part.id}
                    {part.kind === "resistor"
                      ? ` · ${part.resistance === 1000 ? "1k" : part.resistance} Ω`
                      : part.kind === "led"
                        ? lit
                          ? " · ON"
                          : " · OFF"
                        : controls[part.id]
                          ? " · CLOSED"
                          : " · OPEN"}
                  </text>
                </g>
                {[0, 1].map((i) => {
                  const off = leadOffset(part, i),
                    pos = { x: at.x + off.x, y: at.y + off.y };
                  return (
                    <g key={i}>
                      {part.mounts[i] && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r="7"
                          fill="none"
                          stroke="#92b695"
                          strokeWidth="1.5"
                          pointerEvents="none"
                        />
                      )}
                      {terminalNode(
                        `${part.id}:${i}`,
                        pos,
                        endMap.get(`${part.id}:${i}`)!.label,
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
          {pending && endMap.has(pending) && cursor && (
            <path
              d={`M${endMap.get(pending)!.x} ${endMap.get(pending)!.y} L${cursor.x} ${cursor.y}`}
              stroke={ink(color)}
              strokeWidth="2"
              strokeDasharray="5 4"
              pointerEvents="none"
            />
          )}
        </svg>
      </div>
      {!editingLocked && !propertiesHidden && (validSelection || pending) && (
        <div
          className={`builder-inspector ${chosenPart || chosenWire || pending ? "" : "selection-toolbar"}`}
          role="region"
          aria-label="Component properties"
        >
          <div className="properties-header">
            <strong>
              {selectedLabel}
              {chosenPart?.label ? ` · ${chosenPart.label}` : ""}
            </strong>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close component properties"
              onClick={() => {
                setSelection(null);
                cancelWire();
              }}
            >
              <X size={14} />
            </Button>
          </div>
          <div className="builder-selection">
            {chosenPart && (
              <>
                <label className="part-label">
                  Label
                  <input
                    aria-label="Component label"
                    maxLength={24}
                    value={chosenPart.label || ""}
                    placeholder={chosenPart.id}
                    onChange={(e) =>
                      partChange({ ...chosenPart, label: e.target.value })
                    }
                  />
                </label>
                <span>
                  {chosenPart.mounts[0] ? "Mounted" : "Free-standing"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onComponent(chosenPart.kind)}
                >
                  Why this component?
                </Button>
              </>
            )}
            {chosenWire && (
              <span>
                {endMap.get(chosenWire.from)?.label} →{" "}
                {endMap.get(chosenWire.to)?.label}
              </span>
            )}
            {!validSelection && (
              <span>Select a component or wire to edit it.</span>
            )}
          </div>
          <div className="selection-actions">
            {chosenPart && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rotatePart(chosenPart)}
                >
                  <RotateCcw size={12} />
                  Rotate
                </Button>
                {chosenPart.kind === "led" && (
                  <Picker
                    label={`${chosenPart.id} color`}
                    value={chosenPart.ledColor || "red"}
                    items={["red", "amber", "green"].map((color) => ({
                      value: color,
                      label: color[0].toUpperCase() + color.slice(1),
                    }))}
                    onChange={(value) =>
                      commit({
                        ...doc,
                        parts: doc.parts.map((p) =>
                          p.id === chosenPart.id
                            ? { ...p, ledColor: value as Part["ledColor"] }
                            : p,
                        ),
                      })
                    }
                  />
                )}
                {chosenPart.kind === "led" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      commit({
                        ...doc,
                        parts: doc.parts.map((p) =>
                          p.id === chosenPart.id
                            ? { ...p, flipped: !p.flipped }
                            : p,
                        ),
                      })
                    }
                  >
                    Flip + / −
                  </Button>
                ) : chosenPart.kind === "resistor" ? (
                  <Picker
                    label={`${chosenPart.id} resistance`}
                    value={String(chosenPart.resistance)}
                    items={[220, 330, 470, 1000].map((r) => ({
                      value: String(r),
                      label: r === 1000 ? "1 kΩ" : `${r} Ω`,
                    }))}
                    onChange={(value) =>
                      commit({
                        ...doc,
                        parts: doc.parts.map((p) =>
                          p.id === chosenPart.id
                            ? { ...p, resistance: Number(value) }
                            : p,
                        ),
                      })
                    }
                  />
                ) : (
                  <span className="contact-state">
                    {!interactive
                      ? "Run to interact"
                      : controls[chosenPart.id]
                        ? "Contact closed"
                        : "Contact open"}
                  </span>
                )}
              </>
            )}
            {chosenWire && (
              <details className="wire-edit-options">
                <summary>Edit wire</summary>
                <div className="wire-edit-actions">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReconnect({ id: chosenWire.id, end: "from" });
                    setPending(chosenWire.to);
                    setNotice(
                      "Click a new terminal for the start of this wire.",
                    );
                  }}
                >
                  <Unplug size={12} />
                  Move start
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReconnect({ id: chosenWire.id, end: "to" });
                    setPending(chosenWire.from);
                    setNotice("Click a new terminal for the end of this wire.");
                  }}
                >
                  Move end
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Move wire route up"
                  disabled={
                    endMap.get(chosenWire.from)?.x ===
                    endMap.get(chosenWire.to)?.x
                  }
                  onClick={() =>
                    commit({
                      ...doc,
                      wires: doc.wires.map((w) =>
                        w.id === chosenWire.id
                          ? {
                              ...w,
                              routeY: Math.max(
                                -WORLD_LIMIT,
                                (w.routeY ??
                                  Math.min(
                                    endMap.get(w.from)!.y,
                                    endMap.get(w.to)!.y,
                                  ) - 28) - 16,
                              ),
                            }
                          : w,
                      ),
                    })
                  }
                >
                  Route ↑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Move wire route down"
                  disabled={
                    endMap.get(chosenWire.from)?.x ===
                    endMap.get(chosenWire.to)?.x
                  }
                  onClick={() =>
                    commit({
                      ...doc,
                      wires: doc.wires.map((w) =>
                        w.id === chosenWire.id
                          ? {
                              ...w,
                              routeY: Math.min(
                                WORLD_LIMIT,
                                (w.routeY ??
                                  Math.min(
                                    endMap.get(w.from)!.y,
                                    endMap.get(w.to)!.y,
                                  ) - 28) + 16,
                              ),
                            }
                          : w,
                      ),
                    })
                  }
                >
                  ↓
                </Button>
                </div>
              </details>
            )}
            {validSelection && selection?.kind !== "uno" && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete selected component or wire"
                onClick={deleteSelected}
              >
                <Trash2 size={14} />
              </Button>
            )}
            {pending && (
              <Button variant="ghost" size="sm" onClick={cancelWire}>
                <X size={12} />
                Cancel wire
              </Button>
            )}
          </div>
          {(pending || (branch && branch.status !== "ready")) && (
            <p
              className={
                branch && branch.status !== "ready"
                  ? "builder-notice warning"
                  : "builder-notice"
              }
              role="status"
            >
              {branch?.message || notice}
            </p>
          )}
        </div>
      )}
      <div className="canvas-navigation">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out"
          disabled={view.zoom <= MIN_ZOOM}
          onClick={() => zoomBy(-0.25)}
        >
          <Minus size={15} />
        </Button>
        <span>{Math.round(view.zoom * 100)}%</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in"
          disabled={view.zoom >= MAX_ZOOM}
          onClick={() => zoomBy(0.25)}
        >
          <Plus size={15} />
        </Button>
        <span className="nav-divider" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Fit circuit"
          title="Fit circuit"
          onClick={() => setView(fitView(doc, viewport))}
        >
          <Scan size={16} />
        </Button>
      </div>
      {placement && (
        <div className="connection-hint" role="status">
          Drag onto the canvas · or click to place
          <button
            aria-label="Cancel placement"
            onClick={() => setPlacement(null)}
          >
            <X size={13} />
          </button>
        </div>
      )}
      {pending && (
        <div className="connection-hint" role="status">
          Choose the other terminal{" "}
          <button onClick={cancelWire} aria-label="Cancel wire">
            <X size={13} />
          </button>
        </div>
      )}
      {externalTray ? (
        trayTarget ? (
          createPortal(
            <div className="builder-footer">
              <button
                disabled={editingLocked}
                onClick={() => {
                  setSelection(null);
                  commit({
                    ...starterCircuit(),
                    breadboards: [],
                    parts: [],
                    wires: [],
                  });
                  setNotice(
                    "Empty bench. Add a breadboard and components from the tray.",
                  );
                }}
              >
                Clear circuit
              </button>
              <button
                disabled={editingLocked}
                title="Restore Blink wiring and sketch"
                onClick={() => {
                  setSelection(null);
                  cancelWire();
                  setPlacement(null);
                  onRestore();
                }}
              >
                <CornerUpLeft size={11} />
                Restore Blink
              </button>
            </div>,
            trayTarget,
          )
        ) : null
      ) : (
        <div className="builder-footer">
          <button
            disabled={editingLocked}
            onClick={() => {
              setSelection(null);
              commit({
                ...starterCircuit(),
                breadboards: [],
                parts: [],
                wires: [],
              });
              setNotice(
                "Empty bench. Add a breadboard and components from the tray.",
              );
            }}
          >
            Clear circuit
          </button>
          <button
            disabled={editingLocked}
            title="Restore Blink wiring and sketch"
            onClick={() => {
              setSelection(null);
              cancelWire();
              setPlacement(null);
              onRestore();
            }}
          >
            <CornerUpLeft size={11} />
            Restore Blink
          </button>
        </div>
      )}
    </div>
  );
}
