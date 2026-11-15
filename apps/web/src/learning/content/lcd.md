## Run the display

Start simulation. The first row should show **Hello, Piko!**; the second shows elapsed simulated seconds. This project starts with a working circuit and sketch so you can experiment immediately.

The LCD contains its own controller. The Uno sends commands and characters, and the controller remembers the display contents. Arduino’s `LiquidCrystal` library turns your instructions into pin pulses; Piko decodes those pulses in its simulation worker.

This model fixes backlight and contrast internally. It is a simplified module, not a complete physical 16-pin LCD wiring diagram.

## Understand the connections

The breadboard distributes power; the display does not have to sit on it.

- Uno **5V → top + rail → LCD 5V**.
- Uno **GND → top − rail → LCD GND**.
- LCD **RW → ground rail** selects write-only operation.
- LCD **RS → Uno D12**, and **E → Uno D11**.
- LCD **D4, D5, D6, D7 → Uno D5, D4, D3, D2**, respectively.

The rail splits between columns 15 and 16. These power connections all use its first half. Rail markings do not supply power by themselves.

RS selects a command or character data; E signals when to accept it. Four data wires carry each byte in two pieces. The constructor matches that wiring:

```cpp
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
```

Its arguments are **RS, E, D4, D5, D6, D7**, in that order. The LCD’s D4 label and the Uno’s D4 label name different terminals; they do not automatically connect.

## Write your own message

Stop simulation and open Code. Find these instructions inside `setup()`:

```cpp
lcd.begin(16, 2);
lcd.print("Hello, Piko!");
```

`begin()` configures 16 columns and two rows. `print()` writes characters at the current cursor. Change the quoted greeting, keeping it within 16 printable characters:

```cpp
lcd.print("My first LCD!");
```

Run again and look at the first row. It should show your message. Editing code does not change firmware already running; you need a new run.

If nothing appears, check Console for compiler errors and Inspect for wiring issues. **Restore example code** brings back the original sketch while preserving your wiring.

## Position text and values

The second row comes from `loop()`:

```cpp
lcd.setCursor(0, 1);
lcd.print("Seconds: ");
lcd.print(millis() / 1000);
```

Rows and columns start at zero, so `(0, 1)` is the first column on the second row. `millis()` counts simulated milliseconds since the program started. Dividing by 1000 gives whole seconds.

Change `Seconds: ` to `Time: ` and rerun. Then try `lcd.setCursor(2, 1)` to move the label two columns right. Keep the rest of the row inside the 16-column display.

The model supports basic printable text, clear/home, cursor positioning, entry direction and display on/off. Custom glyphs, scrolling, cursor graphics, I²C and analog contrast control are not supported yet.
