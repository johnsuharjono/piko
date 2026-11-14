// HD44780 write-only 4-bit interface. GPIO edges are decoded inside the worker,
// before UI snapshots can lose short enable pulses.
export type LcdPins = { rs: number; enable: number; data: number[] };
export class CharacterLcd {
  private fourBit = false;
  private pending: { value: number; rs: boolean } | null = null;
  private address = 0;
  private increment = true;
  private visible = false;
  private memory = Array(128).fill(" ");
  private previousEnable = false;
  constructor(readonly pins: LcdPins) {}
  sample(high: (pin: number) => boolean) {
    const enable = high(this.pins.enable);
    if (this.previousEnable && !enable) {
      const rs = high(this.pins.rs);
      const nibble = this.pins.data.reduce(
        (value, pin, bit) => value | (Number(high(pin)) << bit),
        0,
      );
      if (!this.fourBit) {
        if (!rs && nibble === 2) {
          this.fourBit = true;
          this.pending = null;
        }
      } else if (!this.pending) this.pending = { value: nibble, rs };
      else {
        const byte = (this.pending.value << 4) | nibble;
        this.write(byte, this.pending.rs);
        this.pending = null;
      }
    }
    this.previousEnable = enable;
  }
  private write(byte: number, rs: boolean) {
    if (rs) {
      this.memory[this.address] =
        byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : "?";
      this.address = (this.address + (this.increment ? 1 : -1) + 128) % 128;
    } else if (byte === 1) {
      this.memory.fill(" ");
      this.address = 0;
    } else if (byte === 2) this.address = 0;
    else if (byte & 128) this.address = byte & 127;
    else if ((byte & 248) === 8) this.visible = !!(byte & 4);
    else if ((byte & 252) === 4) this.increment = !!(byte & 2);
    else if ((byte & 240) === 16) {
      if (!(byte & 8))
        this.address = (this.address + (byte & 4 ? 1 : -1) + 128) % 128;
    }
  }
  lines() {
    return [0, 64].map((start) =>
      this.visible
        ? this.memory.slice(start, start + 16).join("")
        : " ".repeat(16),
    );
  }
}
