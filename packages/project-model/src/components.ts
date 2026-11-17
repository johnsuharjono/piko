// Shared component definitions: the editor, portable diagrams, and pin geometry
// use the same identities. Runtime drivers remain isolated in simulation/.
export type ComponentKind =
  | "uno"
  | "breadboard"
  | "led"
  | "resistor"
  | "button"
  | "switch"
  | "lcd";
export type PinDefinition = { id: string; label: string; x: number; y: number };
export type ComponentDefinition = {
  kind: ComponentKind;
  label: string;
  category: "Boards" | "Inputs" | "Outputs" | "Passive";
  width: number;
  height: number;
  maxInstances: number;
  driver:
    | "avr"
    | "breadboard"
    | "led-branch"
    | "resistor"
    | "contact"
    | "hd44780";
  pins: readonly PinDefinition[];
};
export const LCD_PIN_NAMES = [
  "GND",
  "5V",
  "RW",
  "RS",
  "E",
  "D4",
  "D5",
  "D6",
  "D7",
] as const;
export const COMPONENT_ROWS = [
  "TP",
  "TN",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "BP",
  "BN",
] as const;
export const BREADBOARD_ROW_Y = {
  TP: 32,
  TN: 50,
  A: 90,
  B: 106,
  C: 122,
  D: 138,
  E: 154,
  F: 202,
  G: 218,
  H: 234,
  I: 250,
  J: 266,
  BP: 304,
  BN: 322,
} as const;
const contacts = (x: number, y = 0): PinDefinition[] => [
  { id: "0", label: "Contact 1", x: -x, y },
  { id: "1", label: "Contact 2", x, y },
];
export const COMPONENTS: Record<ComponentKind, ComponentDefinition> = {
  uno: {
    kind: "uno",
    label: "Arduino Uno",
    category: "Boards",
    width: 300,
    height: 240,
    maxInstances: 1,
    driver: "avr",
    pins: [
      ...Array.from({ length: 14 }, (_, i) => ({
        id: `D${i}`,
        label: `Uno D${i}`,
        x: 18 + (13 - i) * 20,
        y: 10,
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `D${14 + i}`,
        label: `Uno A${i}`,
        x: 168 + i * 20,
        y: 230,
      })),
      { id: "GND", label: "Uno GND", x: 50, y: 230 },
      { id: "5V", label: "Uno 5V", x: 90, y: 230 },
    ],
  },
  breadboard: {
    kind: "breadboard",
    label: "Breadboard",
    category: "Passive",
    width: 524,
    height: 354,
    maxInstances: 1,
    driver: "breadboard",
    pins: COMPONENT_ROWS.flatMap((row) =>
      Array.from({ length: 30 }, (_, i) => ({
        id: `${row}:${i + 1}`,
        label: `Breadboard ${row}${i + 1}`,
        x: 30 + i * 16,
        y: BREADBOARD_ROW_Y[row],
      })),
    ),
  },
  resistor: {
    kind: "resistor",
    label: "Resistor",
    category: "Passive",
    width: 60,
    height: 22,
    maxInstances: 12,
    driver: "resistor",
    pins: contacts(24),
  },
  led: {
    kind: "led",
    label: "LED",
    category: "Outputs",
    width: 32,
    height: 48,
    maxInstances: 12,
    driver: "led-branch",
    pins: contacts(8, 18),
  },
  button: {
    kind: "button",
    label: "Pushbutton",
    category: "Inputs",
    width: 32,
    height: 32,
    maxInstances: 12,
    driver: "contact",
    pins: contacts(16),
  },
  switch: {
    kind: "switch",
    label: "Slide switch",
    category: "Inputs",
    width: 32,
    height: 32,
    maxInstances: 12,
    driver: "contact",
    pins: contacts(16),
  },
  lcd: {
    kind: "lcd",
    label: "LCD 16×2",
    category: "Outputs",
    width: 240,
    height: 132,
    maxInstances: 1,
    driver: "hd44780",
    pins: LCD_PIN_NAMES.map((id, i) => ({
      id,
      label: `LCD ${id}`,
      x: 16 + i * 24,
      y: 132,
    })),
  },
};
