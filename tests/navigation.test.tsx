// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { getRouter } from "../apps/web/src/router";
import { Route as rootRoute } from "../apps/web/src/routes/__root";
import { ProjectsContext } from "../apps/web/src/projects/provider";
import { testProjects } from "./project-repository";
import { ThemeProvider } from "../apps/web/src/components/theme-toggle";
// The document shell belongs to SSR; client navigation tests mount in a div.
Object.assign(rootRoute.options, {
  shellComponent: ({ children }: { children: ReactNode }) => (
    <ThemeProvider>
      <ProjectsContext.Provider value={testProjects}>
        {children}
      </ProjectsContext.Provider>
    </ThemeProvider>
  ),
});
import { encodeProject } from "../apps/web/src/projects/format";
import { createProject, getProject } from "./project-repository";
vi.mock("../apps/web/src/components/code-editor", () => ({
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
  const el = Array.from(
    document.querySelectorAll('a,button,[role="menuitemradio"]'),
  ).find(
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
  document.documentElement.classList.add("dark");
  delete document.documentElement.dataset.theme;
});
it("takes a visitor from Home through a project introduction into a fresh bench with a project article", async () => {
  localStorage.setItem(
    "piko.sketch.v1",
    '{"version":1,"sketch":"invalid old sketch"}',
  );
  await mount();
  expect(host.querySelector("h1")?.textContent).toContain("Build a circuit");
  const savedBefore = localStorage.getItem("piko.sketch.v1");
  await click("Change theme");
  await click("Light");
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(document.documentElement.classList.contains("dark")).toBe(false);
  expect(localStorage.getItem("piko.sketch.v1")).toBe(savedBefore);
  expect(host.querySelector(".breadboard-canvas")).toBeNull();
  await act(async () =>
    router.navigate({ to: "/learn/$lessonId", params: { lessonId: "blink" } }),
  );
  expect(router.state.location.pathname).toBe("/learn/blink");
  expect(host.querySelector("h1")?.textContent).toBe("Your first blinking LED");
  await click("Open bench & guide");
  await act(async () => vi.dynamicImportSettled());
  const id = router.state.location.pathname.split("/").at(-1)!;
  expect(getProject(id)?.circuit.wires).toHaveLength(3);
  expect(getProject(id)?.sketch).toContain("delay(500)");
  expect(document.documentElement.dataset.theme).toBe("light");
  await click("Change theme");
  expect(
    document.querySelector('[role="menuitemradio"][aria-checked="true"]')
      ?.textContent,
  ).toBe("Light");
  await click("Dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(getProject(id)?.sketch).toContain("delay(500)");
  expect(host.querySelector('[aria-label="Project guide"]')).toBeTruthy();
  await click("Inspect");
  expect(host.querySelector('[aria-label="Project guide"]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Circuit inspector"]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Arduino sketch"]')).toBeTruthy();
  await click("Code");
  expect(host.querySelector('[aria-label="Arduino sketch"]')).toBeNull();
  await click("Code");
  await act(async () => vi.dynamicImportSettled());
  expect(host.querySelector('[aria-label="Project guide"]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Arduino sketch"]')).toBeTruthy();
  await click("Back to Home");
  expect(host.textContent).toContain("Your projects");
  expect(host.querySelector(`a[href="/bench/${id}"]`)).toBeTruthy();
  await act(async () =>
    router.navigate({ to: "/bench/$projectId", params: { projectId: id } }),
  );
  expect(host.querySelector(".breadboard-canvas")).toBeTruthy();
  expect(getProject(id)?.circuit.wires).toHaveLength(3);
});
it("opens a working LCD with no saved browser state and handles an inaccessible project", async () => {
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
  expect(host.textContent).toContain("Saved");
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  await act(async () =>
    router.navigate({
      to: "/bench/$projectId",
      params: { projectId: "expired" },
    }),
  );
  expect(host.textContent).toContain("Project not found");
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
  expect(host.querySelector('[aria-label="Project guide"]')).toBeTruthy();
  expect(host.querySelector(".lesson-markdown")?.textContent).toContain("D8");
  expect(host.querySelectorAll(".article-section")).toHaveLength(4);
  await click("diagram.json");
  expect(
    host.querySelector('[aria-label="Circuit document"]')?.textContent,
  ).toContain('"components"');
  expect(host.querySelector(".breadboard-canvas")).toBeTruthy();
  await click("Components");
  expect(host.querySelector('[aria-label="Component tray"]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Circuit document"]')).toBeTruthy();
});
