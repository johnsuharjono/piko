// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import {
  ThemeProvider,
  useTheme,
} from "../apps/web/src/components/theme-toggle";
function Appearance() {
  const { theme, preference, setTheme } = useTheme();
  return (
    <>
      <output>
        {preference}:{theme}
      </output>
      <button onClick={() => setTheme("light")}>Light</button>
      <button onClick={() => setTheme("system")}>System</button>
    </>
  );
}
afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
  document.documentElement.classList.add("dark");
});
it("follows the system, honors an explicit choice, and resumes following when System is selected", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let dark = true;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return dark;
    },
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
  }));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <ThemeProvider>
          <Appearance />
        </ThemeProvider>,
      ),
    );
    expect(host.querySelector("output")?.textContent).toBe("system:dark");
    const systemChange = async (value: boolean) =>
      act(async () => {
        dark = value;
        for (const listener of listeners) listener();
      });
    await systemChange(false);
    expect(document.documentElement.dataset.theme).toBe("light");
    await act(async () => host.querySelector("button")!.click());
    await systemChange(true);
    expect(document.documentElement.dataset.theme).toBe("light");
    await act(async () => host.querySelectorAll("button")[1].click());
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
  expect(listeners.size).toBe(0);
});
it("renders the theme dropdown", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const { ThemeToggle } = await import(
    "../apps/web/src/components/theme-toggle"
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>,
      ),
    );
    expect(host.querySelector('[aria-label="Change theme"]')).toBeTruthy();
    await act(async () =>
      (host.querySelector("button") as HTMLButtonElement).click(),
    );
    expect(document.querySelector('[role="menuitemradio"]')).toBeTruthy();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
