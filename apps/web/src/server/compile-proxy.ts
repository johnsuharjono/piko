import { COMPILE_TIMEOUT_MS, compileError, isCompileResult, readSketch } from "@piko/compile-contract";
export type CompilerEnvironment = { COMPILER_URL?: string; COMPILER_TOKEN?: string };
export async function proxyCompile(request: Request, environment: CompilerEnvironment, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== "POST") return compileError("Use POST.", "request", 405);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return compileError("Compile from the Piko workspace.", "request", 403);
  let sketch: string;
  try { sketch = await readSketch(request); }
  catch { return compileError("Send a sketch between 1 and 32,000 characters (request limit: 40 KB).", "request", 400); }
  if (!environment.COMPILER_URL || !environment.COMPILER_TOKEN)
    return compileError("The compiler service is not configured. Contact the site owner.", "toolchain", 503);
  try {
    const base = new URL(environment.COMPILER_URL);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
    if (base.protocol !== "https:" && !(local && base.protocol === "http:"))
      return compileError("The compiler service requires HTTPS.", "toolchain", 503);
    const upstream = await fetcher(new URL("/compile", base), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${environment.COMPILER_TOKEN}` },
      body: JSON.stringify({ sketch }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(COMPILE_TIMEOUT_MS + 5000)]),
      redirect: "manual",
    });
    if (upstream.status >= 300 && upstream.status < 400)
      return compileError("The compiler endpoint must not redirect. Contact the site owner.", "toolchain", 502);
    if (upstream.status === 401 || upstream.status === 403)
      return compileError("The compiler connection is not configured correctly. Contact the site owner.", "toolchain", 503);
    const result: unknown = await upstream.json();
    if (!isCompileResult(result) || (result.ok && !upstream.ok))
      return compileError("The compiler returned an invalid response. Try again.", "toolchain", 502);
    return Response.json(result, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return compileError("Could not reach the compiler service. Try again in a moment.", "toolchain", 503);
  }
}
