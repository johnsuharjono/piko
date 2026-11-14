import { STARTER } from "../lib/examples";
import {
  COLORS,
  holeId,
  starterCircuit,
  type CircuitDoc,
  type Part,
} from "./model";
export type Preset = {
  id: string;
  label: string;
  description: string;
  sketch: string;
  create: () => CircuitDoc;
};
function traffic(count = 3): CircuitDoc {
  const doc = starterCircuit();
  doc.parts = [];
  doc.wires = [];
  for (let i = 0; i < count; i++) {
    const column = 3 + i * 8,
      pin = 13 - i,
      h = (row: Parameters<typeof holeId>[1], n: number) =>
        holeId("BB1", row, n);
    const base: Part = {
      id: `R${i + 1}`,
      kind: "resistor",
      x: 450 + i * 128,
      y: 235,
      rotation: 0,
      flipped: false,
      resistance: 330,
      mounts: [h("B", column), h("B", column + 3)],
    };
    doc.parts.push(base, {
      ...base,
      id: `LED${i + 1}`,
      kind: "led",
      ledColor: (["red", "amber", "green"] as const)[i],
      mounts: [h("D", column + 3), h("D", column + 4)],
    });
    doc.wires.push(
      {
        id: `W${i * 2 + 1}`,
        from: `uno:D${pin}`,
        to: h("A", column),
        color: COLORS[i],
        routeY: 85 - i * 18,
      },
      {
        id: `W${i * 2 + 2}`,
        from: h("E", column + 4),
        to: "uno:GND",
        color: COLORS[5],
        routeY: 515 + i * 20,
      },
    );
  }
  return doc;
}
function inputCircuit(kind: "button" | "switch"): CircuitDoc {
  const doc = starterCircuit(),
    id = kind === "button" ? "BTN1" : "SW1";
  doc.parts.push({
    id,
    kind,
    x: 760,
    y: 290,
    rotation: 0,
    flipped: false,
    resistance: 330,
    mounts: [holeId("BB1", "H", 21), holeId("BB1", "H", 23)],
  });
  doc.wires.push(
    {
      id: "W4",
      from: "uno:D2",
      to: holeId("BB1", "F", 21),
      color: COLORS[2],
      routeY: 70,
    },
    {
      id: "W5",
      from: holeId("BB1", "J", 23),
      to: "uno:GND",
      color: COLORS[5],
      routeY: 550,
    },
  );
  return doc;
}
const inputSketch = `const int LED_PIN = 13;
const int INPUT_PIN = 2;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(INPUT_PIN, INPUT_PULLUP);
}

void loop() {
  // Closing the contact connects D2 to ground.
  bool active = digitalRead(INPUT_PIN) == LOW;
  digitalWrite(LED_PIN, active ? HIGH : LOW);
  delay(5);
}
`;
export const PRESETS: Preset[] = [
  {
    id: "lcd",
    label: "LCD · Hello Piko",
    description:
      "16×2 text display driven by LiquidCrystal over six GPIO pins.",
    create: () => {
      const doc: CircuitDoc = {
        version: 1,
        uno: { x: 40, y: 160 },
        breadboards: [{ id: "BB1", x: 440, y: 340 }],
        parts: [],
        wires: [],
        lcd: { x: 560, y: 40 },
      };
      const h = (row: "TP" | "TN", n: number) => holeId("BB1", row, n);
      // Power is shared through the breadboard. All control wires approach the
      // LCD from below, keeping the glass and its text unobscured.
      doc.wires = [
        {
          id: "W1",
          from: "uno:GND",
          to: h("TN", 1),
          color: COLORS[5],
          via: [
            { x: 90, y: 750 },
            { x: 470, y: 750 },
          ],
        },
        {
          id: "W2",
          from: "uno:5V",
          to: h("TP", 3),
          color: COLORS[0],
          via: [
            { x: 130, y: 730 },
            { x: 502, y: 730 },
          ],
        },
        {
          id: "W3",
          from: h("TN", 7),
          to: "lcd:GND",
          color: COLORS[5],
          routeY: 292,
        },
        {
          id: "W4",
          from: h("TP", 8),
          to: "lcd:5V",
          color: COLORS[0],
          routeY: 308,
        },
        {
          id: "W5",
          from: h("TN", 9),
          to: "lcd:RW",
          color: COLORS[5],
          routeY: 324,
        },
      ];
      const signals = [
        ["RS", 12],
        ["E", 11],
        ["D4", 5],
        ["D5", 4],
        ["D6", 3],
        ["D7", 2],
      ] as const;
      signals.forEach(([name, pin], i) => {
        const x = 58 + (13 - pin) * 20,
          end = 576 + (i + 3) * 24;
        const top = 114 - i * 12,
          lane = 380 + i * 18,
          bottom = 200 + i * 12;
        doc.wires.push({
          id: `W${i + 6}`,
          from: `uno:D${pin}`,
          to: `lcd:${name}`,
          color: COLORS[2],
          via: [
            { x, y: top },
            { x: lane, y: top },
            { x: lane, y: bottom },
            { x: end, y: bottom },
          ],
        });
      });
      return doc;
    },
    sketch: `#include <LiquidCrystal.h>
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

void setup() {
  lcd.begin(16, 2);
  lcd.print("Hello, Piko!");
}

void loop() {
  lcd.setCursor(0, 1);
  lcd.print("Seconds: ");
  lcd.print(millis() / 1000);
  delay(100);
}
`,
  },
  {
    id: "blink",
    label: "Blink",
    description: "One LED blinking every half second.",
    sketch: STARTER,
    create: starterCircuit,
  },
  {
    id: "traffic",
    label: "Traffic light",
    description: "Red, green, then amber on D13, D11, and D12.",
    create: () => traffic(),
    sketch: `const int RED = 13;
const int AMBER = 12;
const int GREEN = 11;

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(AMBER, OUTPUT);
  pinMode(GREEN, OUTPUT);
}

void loop() {
  digitalWrite(RED, HIGH);
  delay(2000);
  digitalWrite(RED, LOW);
  digitalWrite(GREEN, HIGH);
  delay(2000);
  digitalWrite(GREEN, LOW);
  digitalWrite(AMBER, HIGH);
  delay(700);
  digitalWrite(AMBER, LOW);
}
`,
  },
  {
    id: "alternating",
    label: "Alternating LEDs",
    description: "Two LEDs take turns on D13 and D12.",
    create: () => traffic(2),
    sketch: `void setup() {
  pinMode(13, OUTPUT);
  pinMode(12, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  digitalWrite(12, LOW);
  delay(350);
  digitalWrite(13, LOW);
  digitalWrite(12, HIGH);
  delay(350);
}
`,
  },
  {
    id: "button",
    label: "Button light",
    description: "Hold the button to light the LED. Uses D2 INPUT_PULLUP.",
    sketch: inputSketch,
    create: () => inputCircuit("button"),
  },
  {
    id: "switch",
    label: "Switch light",
    description: "Toggle the slide switch to control the LED.",
    sketch: inputSketch,
    create: () => inputCircuit("switch"),
  },
  {
    id: "empty",
    label: "Empty bench",
    description: "An Uno and a blank sketch, ready to wire.",
    create: () => ({
      ...starterCircuit(),
      breadboards: [],
      parts: [],
      wires: [],
    }),
    sketch:
      "void setup() {\n  // Configure your pins here.\n}\n\nvoid loop() {\n  // Make something happen.\n}\n",
  },
];

function counterCircuit(): CircuitDoc {
  const doc = PRESETS.find((p) => p.id === "lcd")!.create();
  const h = (row: Parameters<typeof holeId>[1], col: number) =>
    holeId("BB1", row, col);
  for (const [i, col, pin, label] of [
    [1, 5, 8, "ADD"],
    [2, 12, 9, "RESET"],
  ] as const) {
    doc.parts.push({
      id: `BTN${i}`,
      kind: "button",
      label,
      x: 0,
      y: 0,
      rotation: 0,
      flipped: false,
      resistance: 330,
      mounts: [h("H", col), h("H", col + 2)],
    });
    const x = 58 + (13 - pin) * 20,
      end = 470 + (col - 1) * 16;
    doc.wires.push(
      {
        id: `C${i}A`,
        from: `uno:D${pin}`,
        to: h("F", col),
        color: COLORS[3],
        via: [
          { x, y: -20 - i * 16 },
          { x: 350 - i * 18, y: -20 - i * 16 },
          { x: 350 - i * 18, y: 510 + i * 10 },
          { x: end, y: 510 + i * 10 },
        ],
      },
      {
        id: `C${i}B`,
        from: h("J", col + 2),
        to: h("BN", col + 2),
        color: COLORS[5],
      },
    );
  }
  doc.wires.push({
    id: "CGND",
    from: h("TN", 2),
    to: h("BN", 2),
    color: COLORS[5],
  });
  return doc;
}
export const COUNTER_SKETCH = `#include <LiquidCrystal.h>
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
const int ADD_PIN = 8;
const int RESET_PIN = 9;
unsigned long count = 0;
bool lastAdd = HIGH;
bool lastReset = HIGH;

void showCount() {
  lcd.setCursor(0, 1);
  lcd.print("Count: ");
  lcd.print(count);
  lcd.print("        ");
}

void setup() {
  pinMode(ADD_PIN, INPUT_PULLUP);
  pinMode(RESET_PIN, INPUT_PULLUP);
  lcd.begin(16, 2);
  lcd.print("Button counter");
  showCount();
}

void loop() {
  bool add = digitalRead(ADD_PIN);
  bool reset = digitalRead(RESET_PIN);
  // Count a HIGH-to-LOW edge, rather than every pass through loop().
  if (add == LOW && lastAdd == HIGH) {
    count++;
    showCount();
  }
  if (reset == LOW && lastReset == HIGH) {
    count = 0;
    showCount();
  }
  lastAdd = add;
  lastReset = reset;
  delay(10);
}
`;
PRESETS.push({
  id: "counter",
  label: "LCD button counter",
  description: "Two buttons, one display: count presses and reset to zero.",
  sketch: COUNTER_SKETCH,
  create: counterCircuit,
});
