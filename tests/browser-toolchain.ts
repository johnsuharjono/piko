import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compileWithToolchain } from "../packages/browser-compiler/src/engine";
import { TOOLS } from "../packages/browser-compiler/src/loader";
import type { Toolchain } from "../packages/browser-compiler/src/types";
let chain: Promise<Toolchain> | undefined;
async function load(): Promise<Toolchain> {
  const root = resolve("apps/web/.wasm-public");
  const manifest = JSON.parse(
    await readFile(resolve(root, "compiler/manifest.json"), "utf8"),
  );
  const base = resolve(root, manifest.assetsBase.slice(1));
  const entries = await Promise.all(
    TOOLS.map(async (tool) => ({
      tool,
      factory: (
        await import(
          /* @vite-ignore */ pathToFileURL(resolve(base, `tools/${tool}.mjs`))
            .href
        )
      ).default,
      bytes: new Uint8Array(
        await readFile(resolve(base, `tools/${tool}.wasm`)),
      ),
    })),
  );
  return {
    pack: JSON.parse(await readFile(resolve(base, "uno.json"), "utf8")),
    factories: Object.fromEntries(
      entries.map((e) => [e.tool, e.factory]),
    ) as Toolchain["factories"],
    wasm: Object.fromEntries(
      entries.map((e) => [e.tool, e.bytes]),
    ) as Toolchain["wasm"],
  };
}
export const compileBrowserSketch = async (sketch: string) =>
  compileWithToolchain(sketch, await (chain ??= load()));
