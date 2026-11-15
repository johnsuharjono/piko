import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { COMPILE_TIMEOUT_MS, type CompileResult } from "@piko/compile-contract";
import { Data, Effect } from "effect";

export class CompilerError extends Data.TaggedError("CompilerError")<{
  message: string;
  kind: "toolchain" | "compile" | "busy";
}> {}
let compiling = false;
const toolchain = process.env.ARDUINO_HOME || fileURLToPath(new URL("../../../.arduino/", import.meta.url));

// Effect owns the temporary workspace and releases it on success, failure, or cancellation.
export function compileSketch(sketch: string): Effect.Effect<CompileResult> {
  return Effect.scoped(
    Effect.gen(function* () {
      if (compiling)
        return yield* Effect.fail(
          new CompilerError({
            kind: "busy",
            message: "The compiler is busy. Try Run again in a moment.",
          }),
        );
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          compiling = true;
        }),
        () =>
          Effect.sync(() => {
            compiling = false;
          }),
      );
      const directory = yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: () => mkdtemp(join(tmpdir(), "piko-")),
          catch: () =>
            new CompilerError({
              kind: "toolchain",
              message: "Could not create a temporary compilation folder.",
            }),
        }),
        (directory) =>
          Effect.promise(() =>
            rm(directory, { recursive: true, force: true }).catch(() => {}),
          ),
      );
      const cli =
        process.env.ARDUINO_CLI || join(toolchain, "bin/arduino-cli");
      const config =
        process.env.ARDUINO_CONFIG || join(toolchain, "config.json");
      const nativeBin =
        process.env.ARDUINO_COMPILER_PATH || join(toolchain, "native-bin");
      const nativeArgs = existsSync(join(nativeBin, "avr-g++"))
        ? [
            "--build-property",
            `compiler.path=${nativeBin}/`,
            "--build-property",
            `runtime.tools.ctags.path=${nativeBin}`,
            "--build-property",
            `compiler.c.extra_flags=-B"${nativeBin}/"`,
            "--build-property",
            `compiler.cpp.extra_flags=-B"${nativeBin}/"`,
            "--build-property",
            `compiler.c.elf.extra_flags=-B"${nativeBin}/"`,
          ]
        : [];
      const sketchDir = join(directory, "sketch");
      yield* Effect.tryPromise({
        try: async () => {
          await mkdir(sketchDir);
          await writeFile(join(sketchDir, "sketch.ino"), sketch);
        },
        catch: () =>
          new CompilerError({
            kind: "toolchain",
            message: "Could not write the sketch for compilation.",
          }),
      });
      const output = yield* Effect.tryPromise({
        try: (signal) =>
          new Promise<string>((resolvePromise, reject) => {
            execFile(
              cli,
              [
                "compile",
                ...nativeArgs,
                "--fqbn",
                "arduino:avr:uno",
                "--config-file",
                config,
                "--output-dir",
                join(directory, "build"),
                "--warnings",
                "default",
                "--jobs",
                "1",
                sketchDir,
              ],
              {
                env: {
                  // Do not pass service credentials or unrelated host secrets to tools.
                  HOME: process.env.HOME,
                  TMPDIR: process.env.TMPDIR,
                  XDG_CACHE_HOME: process.env.XDG_CACHE_HOME,
                  ARDUINO_BUILD_CACHE_PATH: process.env.ARDUINO_BUILD_CACHE_PATH,
                  ARDUINO_DIRECTORIES_DOWNLOADS: process.env.ARDUINO_DIRECTORIES_DOWNLOADS,
                  LANG: "C.UTF-8",
                  PATH: `${nativeBin}:${process.env.PATH || ""}`,
                },
                timeout: COMPILE_TIMEOUT_MS,
                maxBuffer: 1024 * 1024,
                signal,
              },
              (error, stdout, stderr) => {
                if (error) {
                  const missing =
                    (error as NodeJS.ErrnoException).code === "ENOENT";
                  const message = missing
                    ? "Arduino toolchain is missing. Run pnpm setup:arduino in the project folder, then try again."
                    : error.killed
                      ? "Compilation exceeded 45 seconds. Simplify the sketch and try again."
                      : `${stderr || stdout || error.message}`
                          .replaceAll(directory + "/", "")
                          .slice(0, 14000);
                  reject(
                    new CompilerError({
                      kind: missing ? "toolchain" : "compile",

                      message,
                    }),
                  );
                } else
                  resolvePromise(
                    (stdout + stderr).replaceAll(directory + "/", ""),
                  );
              },
            );
          }),
        catch: (error) =>
          error instanceof CompilerError
            ? error
            : new CompilerError({
                kind: "compile",

                message: "Compilation was interrupted. Run the sketch again.",
              }),
      });
      const hex = yield* Effect.tryPromise({
        try: () => readFile(join(directory, "build/sketch.ino.hex"), "utf8"),
        catch: () =>
          new CompilerError({
            kind: "compile",

            message:
              "The compiler produced no firmware. Check the installed Arduino AVR core.",
          }),
      });
      return { ok: true as const, hex, output };
    }),
  ).pipe(
    Effect.catchTag("CompilerError", (error) =>
      Effect.succeed({
        ok: false as const,
        message: error.message,
        kind: error.kind,
      }),
    ),
  );
}
