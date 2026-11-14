import { COMPONENTS } from "./components";
export const PALETTE = [
  { kind: "lcd", label: COMPONENTS.lcd.label },
  { kind: "breadboard", label: COMPONENTS.breadboard.label },
  { kind: "resistor", label: COMPONENTS.resistor.label },
  { kind: "led", label: "Red LED" },
  { kind: "led-amber", label: "Amber LED" },
  { kind: "led-green", label: "Green LED" },
  { kind: "button", label: COMPONENTS.button.label },
  { kind: "switch", label: COMPONENTS.switch.label },
] as const;
export type PaletteKind = (typeof PALETTE)[number]["kind"];
