## Run a working circuit

This project starts with a wired LED and a working sketch. Press **Start simulation**. The external LED lights for half a second, then goes dark for half a second.

The small L indicator on the Uno also follows D13. It is separate from the external LED on the breadboard.

The circuit and code are both editable. Stop simulation to change wiring; rerun after changing code to execute your edits.

## Why the LED lights

The output branch is **D13 → 330 Ω resistor → LED → GND**. When the sketch sets D13 HIGH, the output is near 5 V relative to GND and can supply this branch. LOW puts the output near 0 V, so the LED goes dark.

The LED conducts in one direction. Its anode (+, usually the longer leg) faces the resistor; its cathode (−, usually the shorter leg and flat side) faces ground. The resistor limits current in physical hardware. Piko checks this supported wiring digitally; it does not measure or solve analog current.

Breadboard A5 and B5 are connected internally, bringing D13 to the resistor. Within each numbered column, holes a–e share a strip; f–j share a separate strip. The center gap separates them. **Show breadboard strips** reveals those connections.

To test the path, stop simulation, select the D13 jumper, and delete it. Run again: the onboard light can blink while the external LED stays off. Undo the circuit edit to reconnect it.

## Read the sketch

`setup()` runs once and configures D13 as an output:

```cpp
pinMode(LED_PIN, OUTPUT);
```

`loop()` repeats these instructions:

```cpp
digitalWrite(LED_PIN, HIGH);
delay(500);
digitalWrite(LED_PIN, LOW);
delay(500);
```

`delay(500)` waits 500 simulated milliseconds. A complete on/off cycle takes one second. Open Inspect, select D13, and compare the digital trace with the LED.

Pause freezes simulated time and outputs. Resume continues that program. A new run starts again from `setup()`.

## Change the rhythm

Stop simulation, open Code, and change **both** delays to 100. Run again: the LED switches every tenth of a second.

Next, try 100 ms HIGH and 900 ms LOW. A complete cycle still takes one second, but the LED is on for only 10% of it. That fraction is called the *duty cycle*.

For a different experiment, remove the LOW write but keep both delays. Run again. The LED stays on: waiting does not change the last output value.

**Restore example code** in the guide brings back the original sketch without replacing your wiring. Circuit edits have their own Undo.
