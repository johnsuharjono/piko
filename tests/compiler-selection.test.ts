// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { compileSketch } from "../apps/web/src/compiler";
const { compile } = vi.hoisted(() => ({ compile: vi.fn() }));
vi.mock("../packages/browser-compiler/src/client", () => ({ compileInBrowser: compile }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("uses browser compilation in a normal production build without an opt-in flag", async () => {
  vi.stubEnv("MODE", "production");
  vi.stubEnv("VITE_COMPILER", undefined);
  const result = { ok: true, hex: ":00000001FF", output: "Compiled." };
  compile.mockResolvedValue(result);
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ assetsBase: "/compiler/test/" }) });
  vi.stubGlobal("fetch", fetcher);
  expect(await compileSketch("void setup(){}", new AbortController().signal, vi.fn())).toEqual(result);
  expect(fetcher).toHaveBeenCalledWith("/compiler/manifest.json", expect.anything());
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(compile).toHaveBeenCalledOnce();
});
it("calls the compiler service only when native compilation is explicitly selected", async () => {
  vi.stubEnv("VITE_COMPILER", "native");
  const result = { ok: true, hex: ":00000001FF", output: "Compiled." };
  const fetcher = vi.fn().mockResolvedValue({ json: async () => result });
  vi.stubGlobal("fetch", fetcher);
  expect(await compileSketch("void setup(){}", new AbortController().signal, vi.fn())).toEqual(result);
  expect(fetcher).toHaveBeenCalledWith("/api/compile", expect.objectContaining({ method: "POST" }));
  expect(compile).not.toHaveBeenCalled();
});
