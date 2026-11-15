import { expect, it, vi } from "vitest";
import { createCompilerHandler } from "../apps/compiler/src/http";
import { proxyCompile } from "../apps/web/src/server/compile-proxy";
import { readSketch } from "../packages/compile-contract/src/index";
const token = "test-only-credential-".repeat(3);
const source = "void setup(){} void loop(){}";
const result = { ok: true as const, hex: ":00000001FF", output: "Compiled." };
const request = (body: unknown = { sketch: source }, auth = true) => new Request("http://compiler/compile", {
  method: "POST", headers: { ...(auth ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" }, body: JSON.stringify(body),
});
it("requires a service credential before invoking the compiler", async () => {
  const compile = vi.fn().mockResolvedValue(result);
  const handle = createCompilerHandler({ token, compile });
  expect((await handle(request(undefined, false))).status).toBe(401);
  expect(compile).not.toHaveBeenCalled();
  expect((await handle(request())).status).toBe(200);
  expect(compile).toHaveBeenCalledWith(source, expect.any(AbortSignal));
  expect((await handle(new Request("http://compiler/healthz"))).status).toBe(200);
});
it("rejects malformed bodies and bounds authenticated request volume", async () => {
  const compile = vi.fn().mockResolvedValue(result);
  const handle = createCompilerHandler({ token, compile, maxRequestsPerMinute: 2 });
  expect((await handle(request({ sketch: 42 }))).status).toBe(400);
  expect((await handle(request())).status).toBe(200);
  const limited = await handle(request());
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("60");
  expect(compile).toHaveBeenCalledTimes(1);
});
it("rejects a chunked oversized body even without Content-Length", async () => {
  const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("x".repeat(40001))); c.close(); } });
  await expect(readSketch(new Request("http://compiler/compile", { method: "POST", body: stream, duplex: "half" } as RequestInit))).rejects.toThrow("too large");
});
it("proxies valid requests and adds credentials only on the server-to-server hop", async () => {
  const upstream = vi.fn().mockResolvedValue(Response.json(result));
  const response = await proxyCompile(new Request("https://piko.example/api/compile", {
    method: "POST", headers: { Origin: "https://piko.example" }, body: JSON.stringify({ sketch: source }),
  }), { COMPILER_URL: "https://compiler.example", COMPILER_TOKEN: token }, upstream);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(result);
  expect(upstream.mock.calls[0][0].toString()).toBe("https://compiler.example/compile");
  expect(upstream.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${token}`);
  expect(response.headers.get("authorization")).toBeNull();
});
it("rejects cross-origin requests, missing configuration and insecure remote compiler URLs", async () => {
  const upstream = vi.fn();
  const req = (origin?: string) => new Request("https://piko.example/api/compile", { method: "POST", headers: origin ? { Origin: origin } : {}, body: JSON.stringify({ sketch: source }) });
  expect((await proxyCompile(req("https://other.example"), {}, upstream)).status).toBe(403);
  expect((await proxyCompile(req(), {}, upstream)).status).toBe(503);
  expect((await proxyCompile(req(), { COMPILER_URL: "http://remote.example", COMPILER_TOKEN: token }, upstream)).status).toBe(503);
  expect(upstream).not.toHaveBeenCalled();
});
it("sanitizes upstream auth failures and handles HTML errors or unreachable services", async () => {
  const req = () => new Request("https://piko.example/api/compile", { method: "POST", body: JSON.stringify({ sketch: source }) });
  const env = { COMPILER_URL: "https://compiler.example", COMPILER_TOKEN: token };
  for (const upstream of [vi.fn().mockResolvedValue(new Response("internal details", { status: 401 })), vi.fn().mockResolvedValue(new Response("<html>Error</html>", { status: 502 })), vi.fn().mockRejectedValue(new Error("network"))]) {
    const response = await proxyCompile(req(), env, upstream);
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).not.toContain("internal details");
    expect(body).not.toContain(token);
  }
});

it("does not follow compiler redirects with service credentials", async () => {
  const upstream = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { Location: "https://other.example" } }));
  const response = await proxyCompile(new Request("https://piko.example/api/compile", { method: "POST", body: JSON.stringify({ sketch: source }) }), { COMPILER_URL: "https://compiler.example", COMPILER_TOKEN: token }, upstream);
  expect(response.status).toBe(502);
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(upstream.mock.calls[0][1].redirect).toBe("manual");
});
