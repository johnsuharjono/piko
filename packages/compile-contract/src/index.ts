export const MAX_SKETCH_CHARS = 32_000;
export const MAX_REQUEST_BYTES = 40_000;
export const COMPILE_TIMEOUT_MS = 45_000;
export type CompileResult =
  | { ok: true; hex: string; output: string }
  | { ok: false; message: string; kind: string };
export function validateSketch(input: unknown): string {
  const sketch = input && typeof input === "object" && "sketch" in input ? input.sketch : undefined;
  if (typeof sketch !== "string" || !sketch.trim() || sketch.length > MAX_SKETCH_CHARS)
    throw new Error("Send a sketch between 1 and 32,000 characters.");
  return sketch;
}
export function isCompileResult(value: unknown): value is CompileResult {
  if (!value || typeof value !== "object" || !("ok" in value)) return false;
  return value.ok === true
    ? "hex" in value && typeof value.hex === "string" && value.hex.length > 0 && "output" in value && typeof value.output === "string"
    : value.ok === false && "message" in value && typeof value.message === "string" && "kind" in value && typeof value.kind === "string";
}
export async function readSketch(request: Request): Promise<string> {
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) throw new Error("Sketch request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Send a sketch.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new Error("Sketch request is too large.");
      }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return validateSketch(JSON.parse(new TextDecoder().decode(body)));
}
export const compileError = (message: string, kind: string, status: number) =>
  Response.json({ ok: false, message, kind } satisfies CompileResult, {
    status, headers: { "Cache-Control": "no-store" },
  });
