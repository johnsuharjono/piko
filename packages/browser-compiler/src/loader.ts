import type { AssetPack, Tool, ToolFactory, Toolchain } from "./types";
export const TOOLS: Tool[] = ["cc1plus", "avr-as", "avr-ld", "avr-objcopy"];
export async function loadToolchain(base: string): Promise<Toolchain> {
  const get = async (path: string) => {
    const response = await fetch(new URL(path, base));
    if (!response.ok)
      throw new Error(
        `Could not load browser compiler (${response.status}). Check your connection and try Run again.`,
      );
    return response;
  };
  const pack: AssetPack = await (await get("uno.json")).json();
  const entries = await Promise.all(
    TOOLS.map(async (tool) => {
      const url = new URL(`tools/${tool}.mjs`, base).href;
      const [module, bytes] = await Promise.all([
        import(/* @vite-ignore */ url) as Promise<{ default: ToolFactory }>,
        get(`tools/${tool}.wasm`).then((r) => r.arrayBuffer()),
      ]);
      return { tool, factory: module.default, bytes: new Uint8Array(bytes) };
    }),
  );
  return {
    pack,
    factories: Object.fromEntries(
      entries.map((e) => [e.tool, e.factory]),
    ) as Toolchain["factories"],
    wasm: Object.fromEntries(
      entries.map((e) => [e.tool, e.bytes]),
    ) as Toolchain["wasm"],
  };
}
