## Build something that remembers

**Goal:** count button presses on an LCD, then reset the count.

This project combines inputs, a variable and a display. It starts wired and working so you can trace each connection, run it, then change the program.

The ADD button goes to **D8**. RESET goes to **D9**. Both use `INPUT_PULLUP`: released is HIGH; held is LOW. The LCD uses D12, D11 and D5–D2, leaving D8 and D9 for inputs.

## Follow the whole circuit

Use the pin-finder buttons below to locate **D8**, **D9**, or **GND**. The highlight follows the connected net, not just one dot.

Trace each input through a five-hole breadboard strip to its button. The other contact goes to the lower ground rail. A jumper joins that rail to the top ground rail, which returns to Uno GND.

LCD power also uses the breadboard rails. The six blue wires carry LCD commands and data. Wire crossings do not connect unless endpoints share a net.

**Check my bench** verifies both input paths and the LCD connections.

## Count presses, not time held

Start simulation. Hold **ADD**: the display should increase by one and stay there. Release it, then press it again. Reach a count of at least two before checking.

```cpp
if (add == LOW && lastAdd == HIGH) {
  count++;
  showCount();
}
```

The program compares the current reading with its previous reading. It increments on the transition from released to pressed, called a *falling edge*. It does not increment repeatedly while held.

Open Code beside the circuit to find the condition. Open Inspect and select D8 to watch the input while the guide stays visible.

## Reset, then make it yours

Press **RESET** after counting. The display should return to zero. The check must observe an earlier count and a reset input driving the displayed count to zero.

```cpp
count = 0;
showCount();
```

**Experiment:** stop, change `count++` to `count += 2`, and run again. Predict the result before pressing ADD. Reset step code brings back the original counter program without changing the wiring.

**Find a fault:** stop, disconnect a button’s ground jumper and run. Why can it no longer pull its input LOW? Undo the wire edit to repair it.

Download the entire project when you want to keep your experiment. Open that `.piko.json` file from Home to bring back the circuit and code together. Reloading without exporting starts a fresh session.

The buttons are ideal contacts. Real mechanical switches may bounce; this simulator does not model that behavior yet.
