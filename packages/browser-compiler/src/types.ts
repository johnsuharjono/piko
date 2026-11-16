import type { CompileResult } from "@piko/compile-contract";
export type Phase =
  | "Loading browser compiler…"
  | "Compiling sketch…"
  | "Linking firmware…";
export type Request = { sketch: string; assetsBase: string };
export type Reply =
  | { type: "progress"; phase: Phase }
  | { type: "result"; result: CompileResult };
export type AssetPack = {
  headers: Record<string, string>;
  link: Record<string, string>;
  lcdSource: string;
};
export interface ToolModule {
  FS: {
    mkdirTree(path: string): void;
    writeFile(path: string, data: Uint8Array | string): void;
    readFile(path: string): Uint8Array;
  };
  callMain(args: string[]): number;
}
export type Tool = "cc1plus" | "avr-as" | "avr-ld" | "avr-objcopy";
export type ToolFactory = (options: {
  noInitialRun: boolean;
  wasmBinary: Uint8Array;
  print(line: string): void;
  printErr(line: string): void;
}) => Promise<ToolModule>;
export interface Toolchain {
  pack: AssetPack;
  factories: Record<Tool, ToolFactory>;
  wasm: Record<Tool, Uint8Array>;
}
