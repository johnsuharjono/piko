import { CharacterLcd, type LcdPins } from "./lcd";
import {
  CPU,
  avrInstruction,
  AVRIOPort,
  AVRTimer,
  AVRUSART,
  PinState,
  portBConfig,
  portCConfig,
  portDConfig,
  timer0Config,
  timer1Config,
  timer2Config,
  usart0Config,
} from "avr8js";

export type Pin = {
  number: number;
  mode: "INPUT" | "INPUT_PULLUP" | "OUTPUT";
  high: boolean;
};
export type DigitalInputs = Record<number, boolean | null>;
export type Transition = { time: number; high: boolean };
export type Snapshot = {
  time: number;
  pins: Pin[];
  trace: Transition[];
  traces: Transition[][];
  lcd?: string[];
  serial: string;
};
export const FREQUENCY = 16000000;
export const INITIAL: Snapshot = {
  time: 0,
  pins: Array.from({ length: 20 }, (_, number) => ({
    number,
    mode: "INPUT",
    high: false,
  })),
  trace: [{ time: 0, high: false }],
  traces: Array.from({ length: 20 }, () => [{ time: 0, high: false }]),
  serial: "",
};

export function loadHex(hex: string): Uint16Array {
  const bytes = new Uint8Array(32768);
  let base = 0;
  let eof = false;
  for (const raw of hex.trim().split(/\r?\n/)) {
    const line = raw.trim();
    if (!/^:[0-9a-f]+$/i.test(line) || line.length % 2 !== 1)
      throw new Error("Invalid firmware record. Compile the sketch again.");
    const record = Uint8Array.from(line.slice(1).match(/../g)!, (byte) =>
      parseInt(byte, 16),
    );
    const count = record[0];
    if (
      record.length !== count + 5 ||
      record.reduce((sum, n) => sum + n, 0) % 256 !== 0
    )
      throw new Error("Firmware checksum failed. Compile the sketch again.");
    const address = base + ((record[1] << 8) | record[2]);
    const type = record[3];
    if (type === 0) {
      if (address + count > bytes.length)
        throw new Error("Firmware exceeds Arduino Uno flash memory.");
      bytes.set(record.subarray(4, count + 4), address);
    } else if (type === 1) {
      eof = true;
      break;
    } else if (type === 4) base = ((record[4] << 8) | record[5]) * 65536;
    else if (type === 2) base = ((record[4] << 8) | record[5]) * 16;
    else throw new Error(`Unsupported firmware record ${type}.`);
  }
  if (!eof)
    throw new Error("Firmware is incomplete. Compile the sketch again.");
  return new Uint16Array(bytes.buffer);
}

export class Machine {
  readonly cpu: CPU;
  readonly ports: AVRIOPort[];
  readonly timers: AVRTimer[];
  readonly usart: AVRUSART;
  traces: Transition[][] = Array.from({ length: 20 }, () => [
    { time: 0, high: false },
  ]);
  get trace() {
    return this.traces[13];
  }
  serial = "";
  private lastHigh = Array(20).fill(false);
  private inputs: DigitalInputs = {};
  private transitionsThisSlice = 0;
  private lcd?: CharacterLcd;
  constructor(hex: string, lcd?: LcdPins | null) {
    if (lcd) this.lcd = new CharacterLcd(lcd);
    this.cpu = new CPU(loadHex(hex), 2048);
    this.ports = [portDConfig, portBConfig, portCConfig].map(
      (config) => new AVRIOPort(this.cpu, config),
    );
    this.timers = [timer0Config, timer1Config, timer2Config].map(
      (config) => new AVRTimer(this.cpu, config),
    );
    this.usart = new AVRUSART(this.cpu, usart0Config, FREQUENCY);
    this.usart.onByteTransmit = (byte) => {
      this.serial = (this.serial + String.fromCharCode(byte)).slice(-4000);
    };
    this.ports.forEach((port) =>
      port.addListener(() => {
        this.refreshInputs();
        this.recordPins();
        this.lcd?.sample((pin) => this.lastHigh[pin]);
      }),
    );
  }
  private refreshInputs() {
    this.ports.forEach((port, index) => {
      const first = index === 0 ? 0 : index === 1 ? 8 : 14,
        length = index === 0 ? 8 : 6;
      for (let bit = 0; bit < length; bit++) {
        const state = port.pinState(bit);
        if (state !== PinState.Input && state !== PinState.InputPullUp)
          continue;
        const external = this.inputs[first + bit];
        const high =
          external === true ||
          ((external === null || external === undefined) &&
            state === PinState.InputPullUp);
        if (!!(this.cpu.data[port.portConfig.PIN] & (1 << bit)) !== high)
          port.setPin(bit, high);
      }
    });
  }
  private recordPins() {
    this.ports.forEach((port, index) => {
      const first = index === 0 ? 0 : index === 1 ? 8 : 14,
        length = index === 0 ? 8 : 6;
      for (let bit = 0; bit < length; bit++) {
        const number = first + bit,
          state = port.pinState(bit);
        const high =
          state === PinState.High ||
          ((state === PinState.Input || state === PinState.InputPullUp) &&
            !!(this.cpu.data[port.portConfig.PIN] & (1 << bit)));
        if (high !== this.lastHigh[number]) {
          if (++this.transitionsThisSlice > 2000)
            throw new Error(
              `D${number} is switching too fast to display. Add a delay or use a slower signal, then Run again.`,
            );
          this.lastHigh[number] = high;
          this.traces[number].push({ time: this.time, high });
          if (this.traces[number].length > 2048) this.traces[number].shift();
        }
      }
    });
  }
  setInputs(inputs: DigitalInputs) {
    this.inputs = inputs;
    this.transitionsThisSlice = 0;
    this.refreshInputs();
    this.recordPins();
  }

  get time() {
    return this.cpu.cycles / (FREQUENCY / 1000);
  }
  advance(milliseconds: number) {
    if (
      !Number.isFinite(milliseconds) ||
      milliseconds < 0 ||
      milliseconds > 100
    )
      throw new Error("Execution slice must be between 0 and 100 ms.");
    this.transitionsThisSlice = 0;
    const target = this.cpu.cycles + (milliseconds * FREQUENCY) / 1000;
    while (this.cpu.cycles < target) {
      avrInstruction(this.cpu);
      this.cpu.tick();
    }
    if (this.time > 600000)
      throw new Error(
        "This run reached the 10-minute bench limit. Press Run to start a fresh session.",
      );
  }
  snapshot(): Snapshot {
    return {
      time: this.time,
      trace: [...this.trace],
      traces: this.traces.map((trace) => [...trace]),
      serial: this.serial,
      lcd: this.lcd?.lines(),
      pins: Array.from({ length: 20 }, (_, number) => {
        const port = this.ports[number < 8 ? 0 : number < 14 ? 1 : 2];
        const bit =
          number < 8 ? number : number < 14 ? number - 8 : number - 14;
        const state = port.pinState(bit);
        return {
          number,
          mode:
            state === PinState.Input
              ? "INPUT"
              : state === PinState.InputPullUp
                ? "INPUT_PULLUP"
                : "OUTPUT",
          high:
            state === PinState.High ||
            ((state === PinState.Input || state === PinState.InputPullUp) &&
              !!(this.cpu.data[port.portConfig.PIN] & (1 << bit))),
        };
      }),
    };
  }
}
