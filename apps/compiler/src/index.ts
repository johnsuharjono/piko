import { createServer } from "node:http";
import { Readable } from "node:stream";
import { createCompilerHandler } from "./http.ts";

const token = process.env.COMPILER_TOKEN || "";
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port.");
const handle = createCompilerHandler({ token });
const server = createServer(async (incoming, outgoing) => {
  const abort = new AbortController();
  incoming.on("aborted", () => abort.abort());
  outgoing.on("close", () => { if (!outgoing.writableEnded) abort.abort(); });
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) for (const entry of value) headers.append(name, entry);
      else if (value !== undefined) headers.set(name, value);
    }
    const hasBody = incoming.method !== "GET" && incoming.method !== "HEAD";
    const request = new Request(`http://127.0.0.1${incoming.url}`, {
      method: incoming.method,
      headers,
      signal: abort.signal,
      ...(hasBody ? { body: Readable.toWeb(incoming) as ReadableStream<Uint8Array>, duplex: "half" } : {}),
    } as RequestInit);
    const response = await handle(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(await response.text());
  } catch {
    if (!outgoing.headersSent) outgoing.writeHead(500, { "Content-Type": "application/json" });
    outgoing.end(JSON.stringify({ ok: false, message: "Compiler request failed.", kind: "request" }));
  }
});
server.requestTimeout = 60_000;
server.headersTimeout = 10_000;
server.listen(port, host, () => console.log(`Piko compiler listening on http://${host}:${port}`));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close();
    setTimeout(() => process.exit(0), 1000).unref();
  });
}
