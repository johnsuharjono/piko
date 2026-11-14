## Meet the breadboard

**Goal:** build a blinking LED, then make it blink faster.

An LED needs a closed path: **D13 → resistor → LED → GND**. The resistor limits current in real hardware; Piko checks the connection without calculating analog current.

Select **Show breadboard strips**. Each numbered column connects its five a–e holes. The five f–j holes form a separate strip. The center gap separates them.

The + and − rail marks are labels: a rail has no power until you connect it to the Uno.

**Predict:** if the D13 jumper is missing, can the LED light?

## Complete one connection

The resistor, LED and ground return are already placed. One wire is missing.

1. Stop simulation if it is running.
2. Click **Uno D13**.
3. Click breadboard **A5** to finish the wire.

For precise keyboard selection, use **Add wire…**, choose *Uno D13* and *Breadboard A5*, then Connect.

A wire connects at its two ends. Crossing another wire does not join them.

**Why A5?** A5 and B5 share a strip, so D13 reaches the resistor’s first lead at B5.

## Run and explain

Press **Start simulation** and watch the external LED. Open **Inspect**, choose D13 and compare the trace with the light.

```cpp
digitalWrite(LED_PIN, HIGH);
delay(500);
digitalWrite(LED_PIN, LOW);
delay(500);
```

HIGH lasts half a second, then LOW lasts half a second: one complete cycle takes a second.

**Pause** freezes simulated time. **Stop simulation** returns to editing.

The small onboard L indicator also follows D13. It is separate from the external LED on the breadboard.

## Make it your own

Stop simulation, open **Code**, and change **both** delays from 500 to 100. Run again.

If you get stuck, **Reset step code** restores the 500 ms starting sketch and stops simulation without changing your wiring.

Check this step after a few blinks. The check uses simulated pin transitions, so editing text alone does not complete it.

**Try next:** use 100 ms HIGH and 900 ms LOW. The period is still one second, but the LED is on for only 10% of it. That fraction is its *duty cycle*.
