// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { getRouter } from "../src/router";
import { encodeProject } from "../src/projects/format";
import { createProject, getProject } from "../src/projects/store";
vi.mock("../src/components/code-editor", () => ({
  default: ({ value, language }: { value: string; language?: string }) => (
    <textarea
      aria-label={language === "json" ? "Circuit document" : "Arduino sketch"}
      value={value}
      readOnly
    />
  ),
}));
let root: Root, host: HTMLDivElement, router: ReturnType<typeof getRouter>;
async function mount(path = "/") {
  router = getRouter();
  router.update({ history: createMemoryHistory({ initialEntries: [path] }) });
  await router.load();
  await act(async () => root.render(<RouterProvider router={router} />));
}
async function click(text: string) {
  const el = Array.from(host.querySelectorAll("a,button")).find(
    (e) =>
      e.getAttribute("aria-label") === text || e.textContent?.trim() === text,
  );
  expect(el, `Missing ${text}`).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, button: 0, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 30));
  });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("takes a visitor from Home through a project introduction into a fresh guided bench", async () => {
  localStorage.setItem(
    "piko.sketch.v1",
    '{"version":1,"sketch":"invalid old sketch"}',
  );
  await mount();
  expect(host.querySelector("h1")?.textContent).toContain("Build a circuit");
  expect(host.querySelector(".breadboard-canvas")).toBeNull();
  await act(async () =>
    router.navigate({ to: "/learn/$lessonId", params: { lessonId: "blink" } }),
  );
  expect(router.state.location.pathname).toBe("/learn/blink");
  expect(host.querySelector("h1")?.textContent).toBe("Your first blinking LED");
  await click("Start building");
  await act(async () => vi.dynamicImportSettled());
  const id = router.state.location.pathname.split("/").at(-1)!;
  expect(getProject(id)?.circuit.wires).toHaveLength(2);
  expect(getProject(id)?.sketch).toContain("delay(500)");
  expect(host.querySelector('[aria-label="Learning guide"]')).toBeTruthy();
  await click("Inspect");
  expect(host.querySelector('[aria-label="Learning guide"]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Circuit inspector"]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Arduino sketch"]')).toBeTruthy();
  await click("Code");
  expect(host.querySelector('[aria-label="Arduino sketch"]')).toBeNull();
  await click("Code");
  await act(async () => vi.dynamicImportSettled());
  expect(host.querySelector('[aria-label="Learning guide"]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Arduino sketch"]')).toBeTruthy();
  await click("Back to Home");
  expect(host.textContent).toContain("Your open benches");
  expect(host.querySelector(`a[href="/bench/${id}"]`)).toBeTruthy();
  await act(async () =>
    router.navigate({ to: "/bench/$projectId", params: { projectId: id } }),
  );
  expect(host.querySelector(".breadboard-canvas")).toBeTruthy();
  expect(getProject(id)?.circuit.wires).toHaveLength(2);
});
it("opens a working LCD with no saved browser state and explains a missing session", async () => {
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("storage blocked");
  });
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("storage blocked");
    });
  const project = createProject("lcd", false);
  await mount(`/bench/${project.id}`);
  await act(async () => vi.dynamicImportSettled());
  expect(host.querySelector('[aria-label^="16 by 2 LCD:"]')).toBeTruthy();
  expect(host.textContent).toContain("Kept in this session");
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  await act(async () =>
    router.navigate({
      to: "/bench/$projectId",
      params: { projectId: "expired" },
    }),
  );
  expect(host.textContent).toContain("This bench is no longer open");
  expect(host.querySelector(".breadboard-canvas")).toBeNull();
});

it("opens an imported counter in a new bench with code, circuit and guide available together", async () => {
  const source = createProject("counter", true);
  await mount();
  const input = host.querySelector(
    '[aria-label="Open project file"]',
  ) as HTMLInputElement;
  const file = new File([encodeProject(source)], "counter.piko.json", {
    type: "application/json",
  });
  Object.defineProperty(file, "text", {
    value: async () => encodeProject(source),
  });
  Object.defineProperty(input, "files", { value: [file] });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
  });
  await act(async () => vi.dynamicImportSettled());
  const id = router.state.location.pathname.split("/").at(-1)!;
  expect(id).not.toBe(source.id);
  expect(getProject(id)?.circuit).toEqual(source.circuit);
  expect(host.querySelector('[aria-label="Arduino sketch"]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Learning guide"]')).toBeTruthy();
  await click("Find D8");
  expect(
    host
      .querySelector('[data-terminal="uno:D8"]')
      ?.getAttribute("aria-description"),
  ).toBe("Highlighted by guide");
  await click("diagram.json");
  expect(
    host.querySelector('[aria-label="Circuit document"]')?.textContent,
  ).toContain('"components"');
  expect(host.querySelector(".breadboard-canvas")).toBeTruthy();
  await click("Components");
  expect(host.querySelector('[aria-label="Component tray"]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Circuit document"]')).toBeTruthy();
});
