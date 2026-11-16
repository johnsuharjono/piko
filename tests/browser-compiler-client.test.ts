import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { compileInBrowser } from "../packages/browser-compiler/src/client";
import { COMPILE_TIMEOUT_MS } from "@piko/compile-contract";
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage?: (event: { data: unknown }) => void;
  onerror?: () => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
  reply(data: unknown) {
    this.onmessage?.({ data });
  }
}
const latest = () => FakeWorker.instances.at(-1)!;
const options = { assetsBase: "https://piko.test/compiler/version/" };
beforeEach(() => {
  vi.useFakeTimers();
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("reports progress and returns firmware, then disposes the compiler worker", async () => {
  const onProgress = vi.fn();
  const promise = compileInBrowser("void setup(){} void loop(){}", {
    ...options,
    onProgress,
  });
  latest().reply({ type: "progress", phase: "Compiling sketch…" });
  expect(onProgress).toHaveBeenCalledWith("Compiling sketch…");
  const result = { ok: true, hex: ":00000001FF", output: "compiled" };
  latest().reply({ type: "result", result });
  await expect(promise).resolves.toEqual(result);
  expect(latest().terminate).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
it("terminates CPU-bound compilation on timeout", async () => {
  const promise = compileInBrowser("void setup(){} void loop(){}", options);
  vi.advanceTimersByTime(COMPILE_TIMEOUT_MS);
  await expect(promise).resolves.toMatchObject({ ok: false, kind: "timeout" });
  expect(latest().terminate).toHaveBeenCalledOnce();
});
it("cancels the worker on reset/unmount and starts the next compile independently", async () => {
  const controller = new AbortController();
  const promise = compileInBrowser("void setup(){} void loop(){}", {
    ...options,
    signal: controller.signal,
  });
  const previous = latest();
  const cancelled = expect(promise).rejects.toMatchObject({
    name: "AbortError",
  });
  controller.abort();
  await cancelled;
  expect(previous.terminate).toHaveBeenCalledOnce();
  const next = compileInBrowser("void setup(){} void loop(){}", options);
  latest().reply({
    type: "result",
    result: { ok: false, kind: "compile", message: "sketch.ino:2: error" },
  });
  await expect(next).resolves.toMatchObject({ ok: false, kind: "compile" });
});
it("does not create a worker for an already cancelled request", async () => {
  await expect(
    compileInBrowser("void setup(){} void loop(){}", {
      ...options,
      signal: AbortSignal.abort(),
    }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(FakeWorker.instances).toHaveLength(0);
});
it("disposes a crashed compiler and provides an actionable error", async () => {
  const promise = compileInBrowser("void setup(){} void loop(){}", options);
  latest().onerror?.();
  await expect(promise).resolves.toMatchObject({
    ok: false,
    kind: "toolchain",
  });
  expect(latest().terminate).toHaveBeenCalledOnce();
});
