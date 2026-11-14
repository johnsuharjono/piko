export const STARTER = `const int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  delay(500);
}
`;
export const experiments = [
  {
    title: "Pick up the pace",
    detail: "Change both delays to 100 ms. What happens to the period?",
    code: STARTER.replaceAll("500", "100"),
    label: "100 ms blink",
  },
  {
    title: "A little less light",
    detail: "Try 100 ms HIGH and 900 ms LOW. That’s a 10% duty cycle.",
    code: STARTER.replace("delay(500)", "delay(100)").replace(
      "delay(500)",
      "delay(900)",
    ),
    label: "10% duty cycle",
  },
  {
    title: "Send a signal",
    detail:
      "Two short flashes, then a long one. Follow the pattern in the trace.",
    code: `const int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void flash(int duration) {
  digitalWrite(LED_PIN, HIGH);
  delay(duration);
  digitalWrite(LED_PIN, LOW);
  delay(200);
}

void loop() {
  flash(100);
  flash(100);
  flash(600);
  delay(800);
}
`,
    label: "Short · short · long",
  },
  {
    title: "Make a prediction",
    detail: "Remove the LOW write. Does delay() turn the LED off?",
    code: STARTER.replace("  digitalWrite(LED_PIN, LOW);\n", ""),
    label: "Keep it HIGH",
  },
];
