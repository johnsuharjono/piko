## Two circuits, connected by code

This example turns the LED on while you hold the button. The button does not switch the LED’s power directly. The Arduino reads one pin and drives another:

**D2 → program decision → D13**

The two branches share GND:

- **Input:** D2 → button → GND.
- **Output:** D13 → 330 Ω resistor → LED → GND.

Start simulation and hold the button’s center. Release it: the LED turns off. Stop simulation before moving components or editing wires.

## What HIGH, LOW and pull-up mean

HIGH and LOW describe a pin’s voltage **relative to GND**. In this 5 V Uno circuit, HIGH is near 5 V and LOW is near 0 V. These are digital states, not measurements of current and not universal meanings of “on” and “off.”

```cpp
pinMode(INPUT_PIN, INPUT_PULLUP);
```

This enables a resistor **inside the Arduino**, connecting D2 weakly to 5 V. It is separate from the visible resistor beside the LED.

```text
5 V ── internal pull-up resistor ──┬── D2 input
                                  │
                                button
                                  │
                                 GND
```

**Released:** the button is an open switch. D2 draws almost no current, so there is almost no voltage drop across the pull-up. D2 sits near 5 V and reads HIGH. A HIGH input does not require a continuous flow of current through the button.

**Pressed:** the button connects D2 to GND. D2 sits near 0 V and reads LOW. A small current now flows from 5 V through the internal pull-up and the button to GND. The resistor limits that current; pressing does not bypass it.

Without the pull-up, an open button would leave D2 floating: real hardware could read noise instead of a dependable state. Piko models digital states, not analog noise or measured current.

The LED’s resistor stays in the D13 branch the whole time. The button never bypasses that resistor or the LED.

[Arduino’s input pull-up example](https://docs.arduino.cc/built-in-examples/digital/InputPullupSerial) explains the same wiring.

## How the program joins them

Open Code. The sketch sets D13 to OUTPUT, and D2 to INPUT_PULLUP. In `loop()`, it makes this decision repeatedly:

```cpp
bool active = digitalRead(INPUT_PIN) == LOW;
digitalWrite(LED_PIN, active ? HIGH : LOW);
```

`digitalRead()` reads D2. Comparing it with LOW makes `active` true while pressed. The `? :` expression then chooses HIGH for D13 when active, otherwise LOW.

Pressed: **D2 LOW → active true → D13 HIGH → LED on.**

Released: **D2 HIGH → active false → D13 LOW → LED off.**

D13 supplies the LED branch when HIGH. When LOW, there is no forward supply voltage to light this LED. The small onboard D13 light is a separate LED.

Open Inspect and choose D2 to see the input change. Choose D13 to see the program’s output. Their states are opposite in this sketch.

## Reverse the behaviour

Stop simulation. Change only the comparison:

```cpp
bool active = digitalRead(INPUT_PIN) == HIGH;
```

Run again. The LED should stay on while released and go off while pressed. The wiring is identical; your program now interprets the same input differently.

Try replacing the output instruction with `digitalWrite(LED_PIN, HIGH);`. Run again: the LED stays on regardless of the button, because the output no longer uses the input reading.

**Restore example code** brings back the original sketch without changing your wiring. Use Undo for circuit edits.

The button here is an ideal two-terminal contact. Real tactile switches can have four legs and mechanical bounce, which needs additional handling in physical projects.
