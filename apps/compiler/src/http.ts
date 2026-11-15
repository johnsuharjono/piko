import { createHash, timingSafeEqual } from "node:crypto";
import { Effect } from "effect";
import { compileError, readSketch, type CompileResult } from "@piko/compile-contract";
import { compileSketch } from "./compiler.ts";

type Compile = (sketch: string, signal: AbortSignal) => Promise<CompileResult>;
export function createCompilerHandler({ token, compile = (sketch, signal) => Effect.runPromise(compileSketch(sketch), { signal }), maxRequestsPerMinute = 30 }: {
  token: string;
  compile?: Compile;
  maxRequestsPerMinute?: number;
}) {
  if (token.length < 32) throw new Error("COMPILER_TOKEN must contain at least 32 characters.");
  const digest = (value: string) => createHash("sha256").update(value).digest();
  const expected = digest(`Bearer ${token}`);
  const requests: number[] = [];
  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname;
    if (path === "/healthz" && request.method === "GET")
      return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    if (path !== "/compile") return compileError("Not found.", "request", 404);
    if (!timingSafeEqual(expected, digest(request.headers.get("authorization") || "")))
      return compileError("Compiler authentication required.", "auth", 401);
    if (request.method !== "POST") return compileError("Use POST /compile.", "request", 405);
    const now = Date.now();
    while (requests.length && requests[0] <= now - 60_000) requests.shift();
    if (requests.length >= maxRequestsPerMinute) {
      const response = compileError("Compilation limit reached. Try again in a minute.", "busy", 429);
      response.headers.set("Retry-After", "60");
      return response;
    }
    requests.push(now);
    let sketch: string;
    try { sketch = await readSketch(request); }
    catch { return compileError("Send a sketch between 1 and 32,000 characters (request limit: 40 KB).", "request", 400); }
    try {
      const result = await compile(sketch, request.signal);
      const status = result.ok ? 200 : result.kind === "busy" ? 429 : result.kind === "toolchain" ? 503 : 422;
      return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
    } catch {
      return compileError("Compilation was interrupted. Try again.", "compile", 503);
    }
  };
}
