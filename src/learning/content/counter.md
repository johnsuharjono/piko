## Try the counter

Start simulation and press **ADD** twice. The LCD should show **Count: 2**. Hold ADD: the count should increase only once for that press. Press **RESET** to return to zero.

The sketch stores a number in a variable, reads two buttons, and prints the result. This working example brings together the separate button and LCD projects.

## Inputs, output and shared ground

ADD connects **D8 to GND** when pressed. RESET connects **D9 to GND**. Both pins use `INPUT_PULLUP`: an internal resistor holds the released input near 5 V (HIGH), while a pressed button connects it to ground (LOW).

These buttons do not directly power the display. The program reads their states, updates its number, then tells the LCD what to show. All parts share GND as their voltage reference.

The LCD uses D12, D11 and D5–D2 for commands and data. Its power comes through the breadboard rails. The buttons use the lower ground rail, joined to the upper ground rail and Uno GND by jumpers.

Wire crossings do not connect by themselves; endpoints must share a terminal or an internally connected breadboard strip.

## Count a press once

Open Code and find this condition in `loop()`:

```cpp
if (add == LOW && lastAdd == HIGH) {
  count++;
  showCount();
}
```

`add` is the current D8 reading. `lastAdd` is the reading from the previous pass through the loop. This condition is true only when the input has just changed from HIGH to LOW: a *falling edge*.

The program then stores the current reading for the next pass:

```cpp
lastAdd = add;
```

While held, both readings are LOW, so the count does not keep increasing. The counter’s state lives in `count`; `showCount()` sends that value to the LCD.

Try changing the condition to `if (add == LOW)`. Run and hold ADD. The count rises repeatedly because the loop keeps seeing a pressed button. Stop and restore the original condition afterward.

## Make a different counter

Stop simulation and change `count++` to:

```cpp
count += 2;
```

Run and press ADD. Each press should add two. RESET still runs `count = 0;` followed by `showCount();`, so it returns to zero.

Next, change the initial value from `unsigned long count = 0;` to `unsigned long count = 10;`. A fresh run begins at ten, while RESET still sets zero. Initial values and reset behaviour are separate decisions in your code.

**Restore example code** brings back the original program. To keep your experiment across reloads, choose **Project → Export project**. Reopen the .piko.json file from Home to restore code and wiring together.

Buttons here are ideal contacts. Physical mechanical switches can bounce and may need additional debouncing.
