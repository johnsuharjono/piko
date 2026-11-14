// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { PRESETS } from "../src/circuit/presets";
import { CIRCUIT_KEY } from "../src/circuit/use-circuit";
import { starterCircuit } from "../src/circuit/model";
import { STARTER } from "../src/lib/examples";
import { Bench } from "../src/components/bench";
vi.mock("../src/components/code-editor", () => ({
  default: ({ value, language }: { value: string; language?: string }) => (
    <textarea
      aria-label={language === "json" ? "Circuit document" : "Arduino sketch"}
      value={value}
      readOnly
    />
  ),
}));
let root: Root, host: HTMLDivElement;
async function click(element: Element) {
  await act(async () => {
    if (element.getAttribute("role") === "option")
      element.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, button: 0 }),
      );
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));
  });
}
function button(label: string) {
  const found = Array.from(document.querySelectorAll("button")).find(
    (b) =>
      b.getAttribute("aria-label") === label || b.textContent?.trim() === label,
  );
  if (!found) throw new Error(`Missing ${label}`);
  return found;
}
async function choose(label: string, text: string) {
  const trigger = document.querySelector(`[aria-label="${label}"]`)!;
  await click(trigger);
  const popup = document.getElementById(trigger.getAttribute("aria-controls")!);
  expect(popup).toBeTruthy();
  const item = Array.from(popup!.querySelectorAll('[role="option"]')).find(
    (n) => n.textContent === text,
  );
  expect(item).toBeTruthy();
  await click(item!);
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<Bench />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("starts focused on the circuit and keeps its project code when closing/reopening Code", async () => {
  expect(host.querySelector(".breadboard-canvas")).toBeTruthy();
  expect(host.querySelector(".workspace-label")).toBeNull();
  expect(host.querySelector('[aria-label="Arduino code editor"]')).toBeNull();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(host.textContent).not.toContain("Small circuit.");
  await click(button("Code"));
  await act(async () => vi.dynamicImportSettled());
  expect(host.querySelector('[aria-label="Arduino sketch"]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Example sketch"]')).toBeNull();
  expect(
    (host.querySelector('[aria-label="Arduino sketch"]') as HTMLTextAreaElement)
      .value,
  ).toContain("delay(500)");
  await click(button("Close code"));
  expect(host.querySelector(".code-panel")).toBeNull();
  await click(button("Code"));
  expect(
    (host.querySelector('[aria-label="Arduino sketch"]') as HTMLTextAreaElement)
      .value,
  ).toContain("delay(500)");
});
it("opens non-modal inspection and changes the selected pin with shadcn Select", async () => {
  await click(button("Inspect"));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(host.querySelector('[aria-label="Circuit inspector"]')).toBeTruthy();
  expect(host.querySelector(".breadboard-canvas")).toBeTruthy();
  await choose("Inspect pin", "D12");
  expect(
    document.querySelector(".trace-svg")?.getAttribute("aria-label"),
  ).toContain("D12 digital state");
  await click(button("Close inspector"));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  await click(button("Open help"));
  expect(host.querySelector('[aria-label="Bench help"]')).toBeTruthy();
  await choose("Learn about component", "Breadboard");
  expect(
    host.querySelector('[aria-label="Bench help"]')?.textContent,
  ).toContain("Every power rail splits");
});

it("loads a complete preset and can undo both its circuit and sketch", async () => {
  await choose("Bench preset", "Traffic light");
  expect(host.querySelectorAll(".circuit-part")).toHaveLength(6);
  expect(button("Undo preset")).toBeTruthy();
  await click(button("Code"));
  await act(async () => vi.dynamicImportSettled());
  expect(
    (host.querySelector('[aria-label="Arduino sketch"]') as HTMLTextAreaElement)
      .value,
  ).toContain("const int GREEN = 11");
  await click(button("Undo preset"));
  expect(host.querySelectorAll(".circuit-part")).toHaveLength(2);
  expect(
    (host.querySelector('[aria-label="Arduino sketch"]') as HTMLTextAreaElement)
      .value,
  ).toContain("const int LED_PIN = 13");
});

it("restores matching Blink wiring and code, persists them, and can undo both", async () => {
  await choose("Bench preset", "Button light");
  await click(button("Restore Blink"));
  expect(host.querySelectorAll(".circuit-part")).toHaveLength(2);
  expect(host.querySelector('[aria-label="Press BTN1"]')).toBeNull();
  await click(button("Code"));
  await act(async () => vi.dynamicImportSettled());
  const sketch = () =>
    (host.querySelector('[aria-label="Arduino sketch"]') as HTMLTextAreaElement)
      .value;
  expect(sketch()).toBe(STARTER);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
  expect(JSON.parse(localStorage.getItem("piko.sketch.v1")!).sketch).toBe(
    STARTER,
  );
  expect(JSON.parse(localStorage.getItem(CIRCUIT_KEY)!)).toEqual(
    starterCircuit(),
  );
  await click(button("Undo preset"));
  expect(sketch()).toBe(PRESETS.find((p) => p.id === "button")!.sketch);
  expect(host.querySelector('[aria-label="Press BTN1"]')).toBeTruthy();
});

it("repairs previously saved input code paired with restored Blink wiring", async () => {
  await act(async () => root.unmount());
  localStorage.setItem(CIRCUIT_KEY, JSON.stringify(starterCircuit()));
  localStorage.setItem(
    "piko.sketch.v1",
    JSON.stringify({
      version: 1,
      sketch: PRESETS.find((p) => p.id === "button")!.sketch,
    }),
  );
  root = createRoot(host);
  await act(async () => root.render(<Bench />));
  await click(button("Restore Blink"));
  await click(button("Code"));
  await act(async () => vi.dynamicImportSettled());
  expect(
    (host.querySelector('[aria-label="Arduino sketch"]') as HTMLTextAreaElement)
      .value,
  ).toBe(STARTER);
  expect(
    host.querySelector('[aria-label="Bench preset"]')?.textContent,
  ).toContain("Blink");
});

it("loads the LCD preset with matching sketch and restores the prior bench", async () => {
  await choose("Bench preset", "LCD · Hello Piko");
  expect(host.querySelector('[aria-label^="16 by 2 LCD:"]')).toBeTruthy();
  expect(host.querySelectorAll('[data-terminal^="lcd:"]')).toHaveLength(9);
  await click(button("Code"));
  await act(async () => vi.dynamicImportSettled());
  expect(
    (host.querySelector('[aria-label="Arduino sketch"]') as HTMLTextAreaElement)
      .value,
  ).toContain("LiquidCrystal lcd(12, 11, 5, 4, 3, 2)");
  await click(button("Undo preset"));
  expect(host.querySelector('[aria-label^="16 by 2 LCD:"]')).toBeNull();
});

it("toggles Inspect on the right and exposes its state", async () => {
  const toggle = button("Inspect");
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  await click(toggle);
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  const inspector = host.querySelector('[aria-label="Circuit inspector"]')!;
  expect(
    inspector.compareDocumentPosition(host.querySelector(".circuit-panel")!) &
      Node.DOCUMENT_POSITION_PRECEDING,
  ).toBeTruthy();
  await click(toggle);
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  expect(host.querySelector('[aria-label="Circuit inspector"]')).toBeNull();
});

it("renders Markdown lessons, checks a build and preserves saved progress", async () => {
  await click(button("Learn"));
  await act(async () => vi.dynamicImportSettled());
  expect(host.querySelector('[aria-label="Learning guide"]')).toBeTruthy();
  await click(button("Start blink lesson"));
  expect(host.querySelector(".lesson-markdown strong")?.textContent).toBe(
    "Goal:",
  );
  expect(JSON.parse(localStorage.getItem(CIRCUIT_KEY)!).wires).toHaveLength(2);
  await click(button("Read & continue"));
  await click(button("Check my bench"));
  expect(host.textContent).toContain("Connect D13 to A5");
  expect((button("Next") as HTMLButtonElement).disabled).toBe(true);
  const saved = JSON.parse(localStorage.getItem("piko.learning.v1")!);
  expect(saved.progress.blink).toEqual([0]);
  await click(button("Learn"));
  expect(host.querySelector('[aria-label="Learning guide"]')).toBeNull();
  await click(button("Learn"));
  expect(host.querySelector(".step-heading")?.textContent).toBe(
    "Complete one connection",
  );
  await click(button("Inspect"));
  expect(host.querySelector('[aria-label="Learning guide"]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Circuit inspector"]')).toBeTruthy();
  await click(button("Code"));
  expect(host.querySelector('[aria-label="Learning guide"]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Arduino code editor"]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Circuit inspector"]')).toBeTruthy();
});

it("resets LCD step code without replacing the circuit or offering unrelated sketch choices", async () => {
  await click(button("Learn"));
  await act(async () => vi.dynamicImportSettled());
  await click(button("Start LCD lesson"));
  const before = localStorage.getItem(CIRCUIT_KEY);
  await click(button("Step 3: Write your first message"));
  await click(button("Open code"));
  await act(async () => vi.dynamicImportSettled());
  const code = () =>
    (host.querySelector('[aria-label="Arduino sketch"]') as HTMLTextAreaElement)
      .value;
  expect(code()).toContain("// TODO:");
  expect(host.querySelector('[aria-label="Example sketch"]')).toBeNull();
  expect(
    host.querySelector('[aria-label="Restore starter sketch"]'),
  ).toBeNull();
  await click(button("Step 4: Make it say something new"));
  await click(button("Reset step code"));
  expect(code()).toContain('lcd.print("Hello, Piko!");');
  await click(button("Step 3: Write your first message"));
  await click(button("Reset step code"));
  expect(code()).toContain("// TODO:");
  expect(localStorage.getItem(CIRCUIT_KEY)).toBe(before);
  expect(host.textContent).toContain("Your wiring is unchanged");
});

it("rechecks a completed wiring step before advancing if the bench changes", async () => {
  await click(button("Learn"));
  await act(async () => vi.dynamicImportSettled());
  await click(button("Start blink lesson"));
  expect(
    Array.from(host.querySelectorAll("button")).some(
      (b) => b.textContent?.trim() === "Next",
    ),
  ).toBe(false);
  await click(button("Read & continue"));
  await click(host.querySelector('[data-terminal="uno:D13"]')!);
  await click(host.querySelector('[data-terminal="bb:BB1:A:5"]')!);
  await click(button("Check my bench"));
  expect((button("Next") as HTMLButtonElement).disabled).toBe(false);
  // Break the just-validated connection without rechecking manually.
  await click(button("Delete selected component or wire"));
  await click(button("Next"));
  expect(host.querySelector(".step-heading")?.textContent).toBe(
    "Complete one connection",
  );
  expect((button("Next") as HTMLButtonElement).disabled).toBe(true);
  expect(host.textContent).toContain("Connect D13 to A5");
});

it("shows component properties separately from the canvas tool panels", async () => {
  const part = host.querySelector('[aria-label^="Select R1,"]')!;
  await act(async () =>
    part.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ),
  );
  expect(
    host.querySelector('[aria-label="Component properties"]'),
  ).toBeTruthy();
  await click(button("Components"));
  expect(host.querySelector('[aria-label="Component properties"]')).toBeNull();
  expect(host.querySelector('[aria-label="Components panel"]')).toBeTruthy();
  await click(button("Components"));
  expect(
    host.querySelector('[aria-label="Component properties"]'),
  ).toBeTruthy();
  await click(button("Close component properties"));
  expect(host.querySelector('[aria-label="Component properties"]')).toBeNull();
});
