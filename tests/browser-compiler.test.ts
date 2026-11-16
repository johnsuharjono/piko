import { describe, expect, it } from "vitest";
import { compileBrowserSketch } from "./browser-toolchain";
import { sketchSource } from "../packages/browser-compiler/src/engine";

describe.skipIf(process.env.PIKO_TEST_COMPILER !== "browser")(
  "WASM toolchain diagnostics",
  () => {
    it("rejects unknown library includes rather than ignoring them", async () => {
      const result = await compileBrowserSketch(
        "#include <MissingLibrary.h>\nvoid setup(){}\nvoid loop(){}",
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("MissingLibrary.h");
    });
    it("rejects an Uno program that exceeds available flash", async () => {
      const result = await compileBrowserSketch(
        "#include <avr/pgmspace.h>\nconst char large[32700] PROGMEM = {1};\nvoid setup(){Serial.begin(9600);Serial.print(pgm_read_byte(large));} void loop(){}",
      );
      expect(result.ok).toBe(false);
    });
    it("uses GCC diagnostics for malformed C++ and preserves sketch lines", async () => {
      const result = await compileBrowserSketch(
        "void setup(){\n  unknownName();\n}\nvoid loop(){}",
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("sketch.ino:2:");
    });
  },
);
it("adds the Arduino header with an explicit line mapping", () => {
  expect(sketchSource("void setup(){}")).toBe(
    '#include <Arduino.h>\n#line 1 "sketch.ino"\nvoid setup(){}',
  );
});
