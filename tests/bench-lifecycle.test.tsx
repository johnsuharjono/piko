// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useBench } from "../apps/web/src/simulation/use-bench";
import { INITIAL } from "../apps/web/src/simulation/machine";
import { STARTER } from "../apps/web/src/lib/examples";
import type { Reply } from "../apps/web/src/simulation/protocol";

let bench: ReturnType<typeof useBench>;
let root: Root;
let host: HTMLDivElement;
const workers: MockWorker[] = [];
class MockWorker {
  onmessage: ((event: { data: Reply }) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    workers.push(this);
  }
  emit(data: Reply) {
    this.onmessage?.({ data });
  }
}
function Harness() {
  bench = useBench();
  return null;
}
const compiled = { ok: true, hex: ":00000001FF", output: "Compiled." };

beforeEach(async () => {
  vi.stubEnv("VITE_COMPILER", "native");
  workers.length = 0;
  vi.stubGlobal("Worker", MockWorker);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ json: async () => compiled }),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("connects controls to the worker and fully clears circuit state on reset", async () => {
  await act(async () => bench.run(STARTER));
  expect(bench.status).toBe("running");
  expect(workers[0].postMessage).toHaveBeenCalledWith({
    type: "start",
    hex: compiled.hex,
  });
  act(() =>
    workers[0].emit({
      type: "snapshot",
      snapshot: {
        ...INITIAL,
        time: 750,
        pins: INITIAL.pins.map((p) =>
          p.number === 13 ? { ...p, mode: "OUTPUT", high: true } : p,
        ),
      },
    }),
  );
  expect(bench.snapshot.pins[13].high).toBe(true);
  act(() => bench.pause());
  expect(bench.status).toBe("paused");
  expect(workers[0].postMessage).toHaveBeenLastCalledWith({ type: "pause" });
  act(() => bench.resume());
  expect(bench.status).toBe("running");
  expect(workers[0].postMessage).toHaveBeenLastCalledWith({ type: "resume" });
  act(() => bench.reset());
  expect(workers[0].terminate).toHaveBeenCalled();
  expect(bench.status).toBe("idle");
  expect(bench.snapshot).toEqual(INITIAL);
  expect(bench.compiledSource).toBeNull();
  act(() => workers[0].emit({ type: "error", message: "Stale worker error" }));
  expect(bench.status).toBe("idle");
});

it("does not start a late compilation after reset even if the response ignores abort", async () => {
  let finish!: (value: unknown) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  );
  let pending!: Promise<void>;
  act(() => {
    pending = bench.run(STARTER);
  });
  expect(bench.status).toBe("compiling");
  act(() => bench.reset());
  await act(async () => {
    finish({ json: async () => compiled });
    await pending;
  });
  expect(bench.status).toBe("idle");
  expect(workers).toHaveLength(0);
});

it("prevents invalid firmware from replacing the circuit and disposes the old run on rerun", async () => {
  await act(async () => bench.run(STARTER));
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: async () => ({
        ok: false,
        message: "sketch.ino:2: error: expected semicolon",
        kind: "compile",
      }),
    }),
  );
  await act(async () => bench.run("bad source"));
  expect(workers[0].terminate).toHaveBeenCalled();
  expect(workers).toHaveLength(1);
  expect(bench.status).toBe("error");
  expect(bench.message).toContain(":2:");
  expect(bench.compiledSource).toBe(STARTER);
});
