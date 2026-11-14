// @vitest-environment jsdom
import { act, useCallback, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { Circuit } from "../src/components/circuit";
import { useCircuit, CIRCUIT_KEY } from "../src/circuit/use-circuit";
import { analyzeCircuit, holeId, partPosition } from "../src/circuit/model";
import { fitView, DEFAULT_VIEWPORT } from "../src/circuit/viewport";
import { starterCircuit, parseCircuit } from "../src/circuit/model";
import { PRESETS } from "../src/circuit/presets";
import { INITIAL } from "../src/simulation/machine";
let state: ReturnType<typeof useCircuit>, root: Root, host: HTMLDivElement;
const stopped = vi.fn();
let lockEditing: (locked: boolean) => void;
let controlInputs: Record<number, boolean | null> = {};
const pins = INITIAL.pins.map((p) =>
  p.number === 13 ? { ...p, mode: "OUTPUT" as const, high: true } : p,
);
function Harness() {
  state = useCircuit(useCallback(() => stopped(), []));
  const [controls, setControls] = useState<Record<string, boolean>>({});
  const [locked, setLocked] = useState(false);
  lockEditing = setLocked;
  const analysis = analyzeCircuit(state.doc, controls);
  controlInputs = analysis.inputs;
  return (
    <Circuit
      editingLocked={locked}
      doc={state.doc}
      onChange={state.update}
      pins={pins}
      selected={13}
      onPin={() => {}}
      onComponent={() => {}}
      analysis={analysis}
      controls={controls}
      onControlChange={(id, active) =>
        setControls((current) => ({ ...current, [id]: active }))
      }
      canUndo={state.canUndo}
      canRedo={state.canRedo}
      onUndo={state.undo}
      onRedo={state.redo}
      onRestore={() => state.update(starterCircuit())}
    />
  );
}
async function click(element: Element) {
  await act(async () => {
    if (element.getAttribute("role") === "option") {
      element.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, button: 0, buttons: 1 }),
      );
      element.dispatchEvent(
        new MouseEvent("pointerup", { bubbles: true, button: 0, buttons: 0 }),
      );
    }
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
function button(label: string) {
  const b = Array.from(host.querySelectorAll("button")).find(
    (b) => b.getAttribute("aria-label") === label || b.textContent === label,
  );
  if (!b) throw new Error(`No button: ${label}`);
  return b;
}
async function drop(kind: string, x: number, y: number) {
  const canvas = host.querySelector("svg.breadboard-canvas")!;
  const event = new MouseEvent("drop", {
    bubbles: true,
    clientX: x,
    clientY: y,
    cancelable: true,
  });
  Object.defineProperty(event, "dataTransfer", {
    value: { getData: () => kind },
  });
  await act(async () => canvas.dispatchEvent(event));
}
function terminal(id: string) {
  return host.querySelector(`[data-terminal="${id}"]`)!;
}
function key(element: Element, key: string) {
  act(() =>
    element.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    ),
  );
}
async function mount() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<Harness />));
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  stopped.mockClear();
  SVGElement.prototype.setPointerCapture = () => {};
  SVGElement.prototype.hasPointerCapture = () => false;
  await mount();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("deletes a real ground wire, shows an open circuit, and restores it through undo/redo", async () => {
  const wire = host.querySelector('[aria-label^="Select wire W3:"]')!;
  await click(wire);
  await click(button("Delete selected component or wire"));
  expect(analyzeCircuit(state.doc).leds[0].status).toBe("open");
  expect(stopped).toHaveBeenCalled();
  await click(button("Undo circuit edit"));
  expect(analyzeCircuit(state.doc).leds[0].status).toBe("ready");
  await click(button("Redo circuit edit"));
  expect(analyzeCircuit(state.doc).leds[0].status).toBe("open");
});
it("reconnects the actual output wire to D12 and can create a jumper using terminals", async () => {
  await click(host.querySelector('[aria-label^="Select wire W1:"]')!);
  await click(button("Move start"));
  await click(terminal("uno:D12"));
  expect(state.doc.wires[0].from).toBe("uno:D12");
  expect(analyzeCircuit(state.doc).leds[0].source).toBe(12);
  await click(terminal(holeId("BB1", "TN", 15)));
  await click(terminal(holeId("BB1", "TN", 16)));
  expect(state.doc.wires).toHaveLength(4);
  expect(
    analyzeCircuit(state.doc).connected(
      holeId("BB1", "TN", 1),
      holeId("BB1", "TN", 30),
    ),
  ).toBe(true);
});
it("adds components, plugs them into breadboard holes with keyboard movement, and flips polarity", async () => {
  await drop("led", 730, 75);
  expect(state.doc.parts.at(-1)?.id).toBe("LED2");
  const part = host.querySelector('[aria-label^="Select LED1,"]')!;
  key(part, "Enter");
  await click(button("Flip + / −"));
  expect(analyzeCircuit(state.doc).leds[0].status).toBe("reversed");
  await click(button("Flip + / −"));
  const before = partPosition(state.doc, state.doc.parts[1]);
  key(part, "ArrowRight");
  const moved = state.doc.parts[1];
  expect(partPosition(state.doc, moved).x).toBe(before.x + 16);
  expect(moved.mounts[0]).toBe(holeId("BB1", "D", 9));
  expect(moved.mounts[1]).toBe(holeId("BB1", "D", 10));
});
it("connects using shadcn selects and persists the circuit across a remount", async () => {
  await click(button("Add wire…"));
  const choose = async (label: string, text: string) => {
    const trigger = host.querySelector(`[aria-label="${label}"]`)!;
    await click(trigger);
    // Closed popups can remain in the DOM while their exit animation finishes.
    // Select from this trigger's live popup, as a user would.
    const popup = document.getElementById(
      trigger.getAttribute("aria-controls")!,
    );
    expect(popup).toBeTruthy();
    const option = Array.from(popup!.querySelectorAll('[role="option"]')).find(
      (node) => node.textContent === text,
    );
    expect(option).toBeTruthy();
    await click(option!);
    expect(
      trigger.querySelector('[data-slot="select-value"]')?.textContent,
    ).toBe(text);
  };
  await choose("Wire from terminal", "Breadboard TP1");
  await choose("Wire to terminal", "Breadboard TP20");
  await click(button("Connect"));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
  expect(JSON.parse(localStorage.getItem(CIRCUIT_KEY)!).wires).toHaveLength(4);
  await act(async () => root.unmount());
  host.remove();
  await mount();
  expect(state.doc.wires).toHaveLength(4);
  expect(
    analyzeCircuit(state.doc).connected(
      holeId("BB1", "TP", 1),
      holeId("BB1", "TP", 30),
    ),
  ).toBe(true);
});
it("cancels a partial wire with Escape and clears/restores the bench without losing undo", async () => {
  await click(terminal("uno:D12"));
  key(host.querySelector("svg")!, "Escape");
  await click(terminal("uno:D11"));
  expect(state.doc.wires).toHaveLength(3);
  key(host.querySelector("svg")!, "Escape");
  await click(button("Clear circuit"));
  expect(state.doc.parts).toHaveLength(0);
  expect(state.doc.breadboards).toHaveLength(0);
  await click(button("Restore Blink"));
  expect(analyzeCircuit(state.doc).leds[0].status).toBe("ready");
  await click(button("Undo circuit edit"));
  expect(state.doc.parts).toHaveLength(0);
});

it("drags a component onto matching holes and keeps its selection after pointer release", async () => {
  await drop("resistor", 600, 75);
  const part = host.querySelector('[aria-label^="Select R2,"]')!,
    canvas = host.querySelector("svg.breadboard-canvas")!;
  function pointer(target: Element, type: string, x: number, y: number) {
    act(() =>
      target.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          clientX: x,
          clientY: y,
          button: 0,
        }),
      ),
    );
  }
  pointer(part, "pointerdown", 600, 75);
  pointer(canvas, "pointermove", 630, 236);
  pointer(canvas, "pointerup", 630, 236);
  await click(canvas);
  expect(state.doc.parts.at(-1)?.mounts).toEqual([
    holeId("BB1", "B", 12),
    holeId("BB1", "B", 15),
  ]);
  expect(button("Delete selected component or wire")).toBeTruthy();
});

it("zooms, pans empty canvas, and fits without changing circuit connections", async () => {
  const svg = host.querySelector("svg.breadboard-canvas")!,
    before = JSON.stringify(state.doc);
  await click(button("Zoom in"));
  expect(svg.getAttribute("viewBox")?.split(" ").map(Number)[2]).toBe(832);
  act(() =>
    svg.dispatchEvent(
      new MouseEvent("pointerdown", {
        bubbles: true,
        clientX: 100,
        clientY: 100,
        button: 0,
      }),
    ),
  );
  act(() =>
    svg.dispatchEvent(
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 160,
        clientY: 120,
        button: 0,
      }),
    ),
  );
  act(() =>
    svg.dispatchEvent(
      new MouseEvent("pointerup", {
        bubbles: true,
        clientX: 160,
        clientY: 120,
        button: 0,
      }),
    ),
  );
  expect(
    svg.getAttribute("viewBox")?.split(" ").map(Number).slice(0, 2),
  ).toEqual([44, 44]);
  await click(button("Fit circuit"));
  const fit = fitView(state.doc, DEFAULT_VIEWPORT);
  expect(svg.getAttribute("viewBox")).toBe(
    `${fit.x} ${fit.y} ${1040 / fit.zoom} ${640 / fit.zoom}`,
  );
  expect(JSON.stringify(state.doc)).toBe(before);
});

it("places a dragged component using transformed SVG coordinates", async () => {
  await drop("resistor", 600, 75);
  const svg = host.querySelector<SVGSVGElement>("svg.breadboard-canvas")!,
    part = host.querySelector('[aria-label^="Select R2,"]')!;
  Object.defineProperty(svg, "getScreenCTM", {
    value: () => ({ a: 2, inverse: () => ({}) }),
  });
  Object.defineProperty(svg, "createSVGPoint", {
    value: () => ({
      x: 0,
      y: 0,
      matrixTransform() {
        return { x: this.x / 2 - 100, y: this.y / 2 - 25 };
      },
    }),
  });
  const pointer = (element: Element, type: string, x: number, y: number) =>
    act(() =>
      element.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          clientX: x,
          clientY: y,
          button: 0,
        }),
      ),
    );
  pointer(part, "pointerdown", 1400, 200);
  pointer(svg, "pointermove", 1460, 522);
  pointer(svg, "pointerup", 1460, 522);
  expect(state.doc.parts.at(-1)?.mounts).toEqual([
    holeId("BB1", "B", 12),
    holeId("BB1", "B", 15),
  ]);
});

it("does not add a shelf item on click, but supports deliberate keyboard placement", async () => {
  const before = state.doc.parts.length;
  await click(host.querySelector('[data-component="button"]')!);
  expect(state.doc.parts).toHaveLength(before);
  key(host.querySelector("svg.breadboard-canvas")!, "Enter");
  expect(state.doc.parts.at(-1)?.kind).toBe("button");
});
it("zooms out with the wheel to 20% and preserves the circuit", async () => {
  const canvas = host.querySelector("svg.breadboard-canvas")!,
    before = JSON.stringify(state.doc);
  act(() =>
    canvas.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: 3000,
        clientX: 400,
        clientY: 300,
      }),
    ),
  );
  expect(Number(canvas.getAttribute("viewBox")?.split(" ")[2])).toBe(5200);
  expect((button("Zoom out") as HTMLButtonElement).disabled).toBe(true);
  expect(JSON.stringify(state.doc)).toBe(before);
  await click(button("Fit circuit"));
  const fit = fitView(state.doc, DEFAULT_VIEWPORT);
  expect(canvas.getAttribute("viewBox")).toBe(
    `${fit.x} ${fit.y} ${1040 / fit.zoom} ${640 / fit.zoom}`,
  );
});

it("operates momentary and latching contacts without editing or resetting the circuit", async () => {
  await drop("button", 760, 75);
  await click(terminal("uno:D2"));
  await click(terminal("BTN1:0"));
  await click(terminal("uno:GND"));
  await click(terminal("BTN1:1"));
  const count = stopped.mock.calls.length,
    press = host.querySelector('[aria-label="Press BTN1"]')!;
  expect(controlInputs).toEqual({ 2: null });
  act(() =>
    press.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, button: 0 }),
    ),
  );
  expect(controlInputs).toEqual({ 2: false });
  act(() =>
    press.dispatchEvent(
      new MouseEvent("pointerup", { bubbles: true, button: 0 }),
    ),
  );
  expect(controlInputs).toEqual({ 2: null });
  expect(stopped.mock.calls.length).toBe(count);
  await drop("switch", 800, 75);
  const toggle = host.querySelector('[aria-label="Toggle SW1"]')!,
    before = stopped.mock.calls.length;
  await click(toggle);
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  await click(toggle);
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  expect(stopped.mock.calls.length).toBe(before);
});

it("keeps layout edits locked while physical inputs remain usable", async () => {
  await drop("button", 760, 75);
  await click(terminal("uno:D2"));
  await click(terminal("BTN1:0"));
  await click(terminal("uno:GND"));
  await click(terminal("BTN1:1"));
  await act(async () => lockEditing(true));
  const before = JSON.stringify(state.doc),
    edits = stopped.mock.calls.length;
  expect(
    (host.querySelector('[data-component="led"]') as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await click(terminal("uno:D13"));
  await click(terminal("uno:GND"));
  await drop("resistor", 1200, 700);
  key(host.querySelector('[aria-label^="Select BTN1,"]')!, "ArrowRight");
  key(host.querySelector("svg.breadboard-canvas")!, "Delete");
  expect(JSON.stringify(state.doc)).toBe(before);
  const control = host.querySelector('[aria-label="Press BTN1"]')!;
  act(() =>
    control.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true }),
    ),
  );
  expect(controlInputs[2]).toBe(false);
  act(() =>
    control.dispatchEvent(
      new KeyboardEvent("keyup", { key: " ", bubbles: true }),
    ),
  );
  expect(controlInputs[2]).toBeNull();
  expect(stopped.mock.calls.length).toBe(edits);
  await act(async () => lockEditing(false));
  expect(
    (host.querySelector('[data-component="led"]') as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});

it("places and saves components beyond the old fixed drawing bounds", async () => {
  await drop("resistor", 2200, -600);
  expect(state.doc.parts.at(-1)).toMatchObject({ x: 2200, y: -600 });
  expect(parseCircuit(state.doc)).toEqual(state.doc);
  const component = host.querySelector(
    `[aria-label^="Select ${state.doc.parts.at(-1)!.id},"]`,
  )!;
  key(component, "ArrowRight");
  expect(state.doc.parts.at(-1)?.x).toBeGreaterThan(2200);
  const from = state.doc.parts.at(-1)!;
  const canvas = host.querySelector("svg.breadboard-canvas")!;
  for (const [target, type, x, y] of [
    [component, "pointerdown", from.x, from.y],
    [canvas, "pointermove", -700, 1800],
    [canvas, "pointerup", -700, 1800],
  ] as const) {
    act(() =>
      target.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          button: 0,
          clientX: x,
          clientY: y,
        }),
      ),
    );
  }
  expect(state.doc.parts.at(-1)).toMatchObject({ x: -700, y: 1800 });
  expect(parseCircuit(state.doc)).toEqual(state.doc);
});

it("measures the HTML work area and updates the camera when its size changes", async () => {
  let resize: (
    entries: { contentRect: { width: number; height: number } }[],
  ) => void = () => {};
  const observe = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: typeof resize) {
        resize = callback;
      }
      observe = observe;
      disconnect() {}
    },
  );
  await act(async () => root.render(<Harness key="wide-screen" />));
  expect(
    observe.mock.calls[0][0].classList.contains("breadboard-viewport"),
  ).toBe(true);
  const canvas = host.querySelector(".breadboard-canvas")!;
  act(() => resize([{ contentRect: { width: 3616, height: 2017 } }]));
  const wide = canvas.getAttribute("viewBox")!.split(" ").map(Number);
  expect(wide.slice(2)).toEqual([3616, 2017]);
  act(() => resize([{ contentRect: { width: 1696, height: 937 } }]));
  const smaller = canvas.getAttribute("viewBox")!.split(" ").map(Number);
  expect(smaller.slice(2)).toEqual([1696, 937]);
  expect(smaller[0] + 1696 / 2).toBe(wide[0] + 3616 / 2);
  expect(smaller[1] + 937 / 2).toBe(wide[1] + 2017 / 2);
});

it("places, saves, and removes an LCD module through circuit undo", async () => {
  await drop("lcd", 600, 100);
  expect(state.doc.lcd).toEqual({ x: 600, y: 100 });
  expect(parseCircuit(state.doc)?.lcd).toEqual(state.doc.lcd);
  expect(host.querySelectorAll('[data-terminal^="lcd:"]')).toHaveLength(9);
  await click(button("Undo circuit edit"));
  expect(state.doc.lcd).toBeUndefined();
});

it("selects an added LCD, nudges it, and deletes it from its selection controls", async () => {
  await drop("lcd", 600, 100);
  const lcd = host.querySelector('[aria-label^="16 by 2 LCD:"]')!;
  expect(lcd.getAttribute("aria-pressed")).toBe("true");
  key(lcd, "Escape");
  expect(lcd.getAttribute("aria-pressed")).toBe("false");
  await click(lcd.querySelector('rect[width="198"]')!);
  expect(lcd.getAttribute("aria-pressed")).toBe("true");
  expect(host.querySelector(".properties-header strong")?.textContent).toBe(
    "LCD 16×2",
  );
  key(lcd, "ArrowRight");
  expect(state.doc.lcd).toEqual({ x: 616, y: 100 });
  await click(button("Delete selected component or wire"));
  expect(state.doc.lcd).toBeUndefined();
  expect(host.querySelector('[aria-label^="16 by 2 LCD:"]')).toBeNull();
  await click(button("Undo circuit edit"));
  expect(state.doc.lcd).toEqual({ x: 616, y: 100 });
});

it("deletes the selected LCD and its attached wires with the keyboard, preserving other wires and undo", async () => {
  await act(async () =>
    state.update(PRESETS.find((p) => p.id === "lcd")!.create()),
  );
  const before = structuredClone(state.doc);
  const lcd = host.querySelector('[aria-label^="16 by 2 LCD:"]')!;
  key(lcd, "Enter");
  key(lcd, "Delete");
  expect(state.doc.lcd).toBeUndefined();
  expect(state.doc.wires).toEqual(
    before.wires.filter(
      (w) => !w.from.startsWith("lcd:") && !w.to.startsWith("lcd:"),
    ),
  );
  expect(parseCircuit(state.doc)).toEqual(state.doc);
  await click(button("Undo circuit edit"));
  expect(state.doc).toEqual(before);
});

it("keeps LCD selection and editing locked during simulation, then restores them when stopped", async () => {
  await drop("lcd", 600, 100);
  await act(async () => lockEditing(true));
  const lcd = host.querySelector('[aria-label^="16 by 2 LCD:"]')!;
  const before = JSON.stringify(state.doc);
  await click(lcd);
  key(lcd, "Enter");
  key(lcd, "ArrowRight");
  key(lcd, "Delete");
  expect(lcd.getAttribute("aria-pressed")).toBe("false");
  expect(JSON.stringify(state.doc)).toBe(before);
  await act(async () => lockEditing(false));
  await click(lcd);
  expect(lcd.getAttribute("aria-pressed")).toBe("true");
  key(lcd, "Backspace");
  expect(state.doc.lcd).toBeUndefined();
});
