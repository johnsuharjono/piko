import { isCompileResult, type CompileResult } from "@piko/compile-contract";

// Backend choice is build-time only; sketches and the simulator share the same
// result contract. Native compilation requires explicit opt-in; the default
// production build must never silently send sketches to a server.
export async function compileSketch(
  sketch: string,
  signal: AbortSignal,
  onProgress: (message: string) => void,
): Promise<CompileResult> {
  if (import.meta.env.VITE_COMPILER !== "native") {
    const { compileInBrowser } = await import("@piko/browser-compiler");
    onProgress("Loading browser compiler…");
    const response = await fetch("/compiler/manifest.json", {
      signal,
      cache: "no-cache",
    });
    if (!response.ok)
      throw new Error(
        "Browser compiler assets are missing. Run pnpm prepare:wasm first.",
      );
    const manifest: unknown = await response.json();
    if (
      !manifest ||
      typeof manifest !== "object" ||
      !("assetsBase" in manifest) ||
      typeof manifest.assetsBase !== "string"
    )
      throw new Error("Invalid browser compiler manifest.");
    const assetsBase = new URL(manifest.assetsBase, location.origin);
    if (
      assetsBase.origin !== location.origin ||
      !assetsBase.pathname.startsWith("/compiler/")
    )
      throw new Error("Invalid browser compiler asset location.");
    return compileInBrowser(sketch, {
      assetsBase: assetsBase.href,
      signal,
      onProgress,
    });
  }
  const response = await fetch("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sketch }),
    signal,
  });
  const result: unknown = await response.json();
  if (!isCompileResult(result)) throw new Error("Invalid compiler response.");
  return result;
}
