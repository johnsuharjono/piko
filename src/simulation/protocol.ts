import type { Snapshot, DigitalInputs } from "./machine";
export type Command =
  | {
      type: "start";
      hex: string;
      lcd?: import("./lcd").LcdPins | null;
      inputs?: DigitalInputs;
    }
  | { type: "inputs"; inputs: DigitalInputs }
  | { type: "pause" | "resume" };
export type Reply =
  { type: "snapshot"; snapshot: Snapshot } | { type: "error"; message: string };
