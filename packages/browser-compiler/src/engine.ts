import { validateSketch, type CompileResult } from "@piko/compile-contract";
import type { Phase, Tool, Toolchain } from "./types";

// This is an Uno-only build driver, not an Arduino CLI port. GCC handles C++
// parsing; we deliberately require helper functions to be declared before use.
export function sketchSource(source: string): string {
  return '#include <Arduino.h>\n#line 1 "sketch.ino"\n' + source;
}
const cppFlags = [
  "-quiet",
  "-imultilib",
  "avr5",
  "-D__AVR_ATmega328P__",
  "-D__AVR_DEVICE_NAME__=atmega328p",
  "-DF_CPU=16000000L",
  "-DARDUINO=10819",
  "-DARDUINO_AVR_UNO",
  "-DARDUINO_ARCH_AVR",
  "-isystem",
  "/sysroot/gcc/include",
  "-isystem",
  "/sysroot/avr/include",
  "-I/arduino/core",
  "-I/arduino/variant",
  "-I/libraries/LiquidCrystal",
  "-mmcu=avr5",
  "-mn-flash=1",
  "-mno-skip-bug",
  "-Os",
  "-std=gnu++11",
  "-fpermissive",
  "-fno-exceptions",
  "-fno-rtti",
  "-fno-threadsafe-statics",
  "-ffunction-sections",
  "-fdata-sections",
];
const decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function compileWithToolchain(
  source: string,
  chain: Toolchain,
  progress: (phase: Phase) => void = () => {},
): Promise<CompileResult> {
  const log: string[] = [];
  try {
    validateSketch({ sketch: source });
    const run = async (
      tool: Tool,
      args: string[],
      files: Record<string, string | Uint8Array>,
      output: string,
    ) => {
      const mod = await chain.factories[tool]({
        noInitialRun: true,
        wasmBinary: chain.wasm[tool],
        print: (line) => {
          if (log.length < 200) log.push(line);
        },
        printErr: (line) => {
          if (log.length < 200) log.push(line);
        },
      });
      for (const [path, data] of Object.entries(files)) {
        mod.FS.mkdirTree(path.slice(0, path.lastIndexOf("/")) || "/");
        mod.FS.writeFile(path, data);
      }
      mod.FS.mkdirTree("/build");
      const status = mod.callMain(args);
      if (status)
        throw new Error(
          log.join("\n") || `${tool} exited with status ${status}.`,
        );
      return mod.FS.readFile(output).slice();
    };
    progress("Compiling sketch…");
    const headers = Object.fromEntries(
      Object.entries(chain.pack.headers).map(([path, data]) => [
        path,
        decode(data),
      ]),
    );
    const compileObject = async (name: string, text: string) => {
      const assembly = await run(
        "cc1plus",
        [...cppFlags, `/build/${name}.cpp`, "-o", `/build/${name}.s`],
        { ...headers, [`/build/${name}.cpp`]: text },
        `/build/${name}.s`,
      );
      return run(
        "avr-as",
        ["-mmcu=atmega328p", "-o", `/build/${name}.o`, `/build/${name}.s`],
        { [`/build/${name}.s`]: assembly },
        `/build/${name}.o`,
      );
    };
    const sketch = await compileObject("sketch", sketchSource(source));
    const lcd = /^\s*#\s*include\s*[<"]LiquidCrystal\.h[>"]/m.test(source)
      ? await compileObject("LiquidCrystal", chain.pack.lcdSource)
      : null;
    progress("Linking firmware…");
    const link = Object.fromEntries(
      Object.entries(chain.pack.link).map(([path, data]) => [
        path,
        decode(data),
      ]),
    );
    const objects = Object.keys(link).filter((path) =>
      path.startsWith("/objects/"),
    );
    const elf = await run(
      "avr-ld",
      [
        "-m",
        "avr5",
        "-Tdata=0x800100",
        "--gc-sections",
        "--defsym=__TEXT_REGION_LENGTH__=32256",
        "--defsym=__DATA_REGION_LENGTH__=2048",
        "-o",
        "/build/sketch.elf",
        "/libs/crtatmega328p.o",
        "/build/sketch.o",
        ...(lcd ? ["/build/LiquidCrystal.o"] : []),
        ...objects,
        "-L/libs",
        "--start-group",
        "-lm",
        "-lc",
        "-lgcc",
        "--end-group",
      ],
      {
        ...link,
        "/build/sketch.o": sketch,
        ...(lcd ? { "/build/LiquidCrystal.o": lcd } : {}),
      },
      "/build/sketch.elf",
    );
    const hex = await run(
      "avr-objcopy",
      ["-O", "ihex", "-R", ".eeprom", "/build/sketch.elf", "/build/sketch.hex"],
      { "/build/sketch.elf": elf },
      "/build/sketch.hex",
    );
    return {
      ok: true,
      hex: new TextDecoder().decode(hex),
      output: `Compiled in your browser for Arduino Uno (AVR-GCC 7.3; no LTO).\n${log.join("\n")}`,
    };
  } catch (error) {
    return {
      ok: false,
      kind: "compile",
      message: (
        log.join("\n") ||
        (error instanceof Error ? error.message : String(error))
      ).slice(0, 14000),
    };
  }
}
