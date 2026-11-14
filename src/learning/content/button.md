## Predict the input

**Goal:** understand how a physical input changes a program’s output.

This project adds a momentary pushbutton to the Blink circuit. One contact connects to D2; the other connects to GND.

`INPUT_PULLUP` holds the unpressed input HIGH. Pressing the button joins D2 to GND, making it LOW.

**Predict:** will pressing the button read HIGH or LOW? The answer is LOW—pressed does not always mean HIGH.

## Follow the circuit

Locate the button on the lower half of the breadboard. Its contacts occupy **H21** and **H23**.

- D2 connects to F21. F21 and H21 share a strip.
- J23 connects to GND. J23 and H23 share another strip.
- Holding the button joins the two contacts.

Use **Show breadboard strips** or hover a terminal to follow the connection.

This is an ideal two-terminal button model. Real tactile switches may have four legs and mechanical bounce.

## Press and release

Start simulation. **Hold the button’s center**, then release it. The LED should turn on while held, then turn off.

You can also focus the button and hold Space or Enter. During simulation the canvas operates inputs; stop first to move parts or change wires.

```cpp
bool active = digitalRead(INPUT_PIN) == LOW;
digitalWrite(LED_PIN, active ? HIGH : LOW);
```

The check needs to observe both the pressed/light-on and released/light-off states during this lesson.

## Experiment with the logic

Try changing `== LOW` to `== HIGH`. Stop and rerun the sketch: the LED should now be on while released and off while held.

**Explain it:** the wiring has not changed. The program changed how it interprets the input.

A future counter project needs *edge detection*: count a press once, rather than once on every pass through `loop()`. On real hardware, debouncing is another step.
