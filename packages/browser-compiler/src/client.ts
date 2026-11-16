import {
  COMPILE_TIMEOUT_MS,
  validateSketch,
  isCompileResult,
  type CompileResult,
} from "@piko/compile-contract";
import type { Phase, Reply, Request } from "./types";
export type { Phase } from "./types";
export function compileInBrowser(
  sketch: string,
  options: {
    assetsBase: string;
    signal?: AbortSignal;
    onProgress?: (phase: Phase) => void;
  },
): Promise<CompileResult> {
  validateSketch({ sketch });
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new DOMException("Compilation cancelled.", "AbortError"));
      return;
    }
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    const finish = (result?: CompileResult, error?: Error) => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
      worker.terminate();
      if (error) reject(error);
      else resolve(result!);
    };
    const cancel = () =>
      finish(
        undefined,
        new DOMException("Compilation cancelled.", "AbortError"),
      );
    const timer = setTimeout(
      () =>
        finish({
          ok: false,
          kind: "timeout",
          message:
            "Browser compilation exceeded 45 seconds. Check your connection and retry; the first run downloads the compiler. For a large sketch, simplify it or try a faster device.",
        }),
      COMPILE_TIMEOUT_MS,
    );
    options.signal?.addEventListener("abort", cancel, { once: true });
    worker.onmessage = ({ data }: MessageEvent<Reply>) => {
      if (data.type === "progress") options.onProgress?.(data.phase);
      else if (data.type === "result" && isCompileResult(data.result))
        finish(data.result);
      else finish(undefined, new Error("Invalid browser compiler response."));
    };
    worker.onerror = () =>
      finish({
        ok: false,
        kind: "toolchain",
        message:
          "The browser compiler stopped unexpectedly. Press Run to retry.",
      });
    worker.postMessage({
      sketch,
      assetsBase: options.assetsBase,
    } satisfies Request);
  });
}
