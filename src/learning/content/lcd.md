## A display is a device

**Goal:** send text and a changing value to a 16×2 LCD.

The screen contains its own controller. The Uno sends commands and character data; the controller remembers what to display.

This project uses Arduino’s `LiquidCrystal` library and a four-bit interface. The library turns `lcd.print()` into pin pulses. Piko decodes those pulses in the simulation worker.

This educational module fixes contrast and backlight internally. It is not a complete physical 16-pin LCD wiring diagram.

## Trace power and signals

The breadboard is a **power distribution point** here. The LCD does not have to sit on it.

- Uno **5V → top + rail → LCD 5V**.
- Uno **GND → top − rail → LCD GND**.
- LCD **RW → the same ground rail** selects write-only operation.
- **RS → D12**, **E → D11**.
- LCD **D4, D5, D6, D7 → Uno D5, D4, D3, D2** respectively.

The rail splits between columns 15 and 16. All these power connections use the first half.

Wire colors are a visual convention, not an electrical property: orange marks supply, gray marks ground, and blue marks data/control in this example.

## Write your first message

**Your task:** add the missing print instruction. The guided sketch initializes the LCD, but deliberately leaves its first row blank.

1. Stop simulation and open **Code** on the right.
2. Find `void setup()`. After `lcd.begin(16, 2);`, replace the TODO comments with this line:

```cpp
lcd.print("Hello, Piko!");
```

3. Keep this line **inside setup’s braces**, after `lcd.begin()` and before the closing `}`.
4. Press **Start simulation**. You should see **Hello, Piko!** on the first row and seconds on the second.
5. Press **Check my bench**. A running counter alone will not pass: the first-row greeting must appear.

`lcd.begin(16, 2)` sets up the 16 columns and two rows. `lcd.print()` sends characters at the current cursor position. `setup()` runs once at startup.

If the screen stays blank, open Inspect for wiring issues, then Console for compiler or execution errors. Code changes need a fresh run. If you get stuck, **Reset step code** restores the TODO scaffold for this step and stops the simulation. It keeps your circuit wiring.

## Make it say something new

**Your task:** change the greeting in your code, then run it again.

1. Stop simulation.
2. In `setup()`, replace only the text between the quotation marks. For example:

```cpp
lcd.print("My first LCD!");
```

3. Use a nonempty message of at most 16 printable characters. Keep the quotation marks and semicolon.
4. Start simulation again, then **Check my bench**. The check reads the LCD’s first row; leaving the original greeting or only editing the code will not pass.

**Predict:** what happens if you edit the message while the program is running? The current program keeps its old message until you stop and rerun.

The second row comes from these instructions in `loop()`:

```cpp
lcd.setCursor(0, 1);
lcd.print("Seconds: ");
lcd.print(millis() / 1000);
```

Columns and rows start at zero: `(0, 1)` is the first column of the second row. `millis()` counts simulated milliseconds since this program started.

**Reset step code** on this step brings back the original greeting so you can try again. It does not load a different example or change the wiring.

**Extra experiment:** change `Seconds: ` to `Time: `, stop and rerun. The number still advances because the program is printing a value, not a fixed picture.

This first model supports basic printable text, clear/home, positioning, entry direction and display on/off. Custom glyphs, scrolling, cursor graphics, I²C and analog contrast control are not supported yet.
