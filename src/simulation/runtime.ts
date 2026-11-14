import { Machine } from "./machine";
import type { Command, Reply } from "./protocol";

// Runs fixed, bounded slices. The browser worker owns this runtime; tests use a virtual clock.
export class SimulationRuntime {
  private machine: Machine | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private nextTick = 0;
  private lastPublish = 0;
  constructor(private readonly send: (reply: Reply) => void) {}
  private publish() {
    if (this.machine)
      this.send({ type: "snapshot", snapshot: this.machine.snapshot() });
  }
  private tick = () => {
    if (!this.running || !this.machine) return;
    try {
      this.machine.advance(8);
      if (performance.now() - this.lastPublish >= 32) {
        this.publish();
        this.lastPublish = performance.now();
      }
      this.nextTick += 8;
      this.nextTick = Math.max(this.nextTick, performance.now() - 8);
      this.timer = setTimeout(
        this.tick,
        Math.max(0, this.nextTick - performance.now()),
      );
    } catch (error) {
      this.running = false;
      this.publish();
      this.send({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Simulation stopped. Run again.",
      });
    }
  };
  handle(data: Command) {
    if (data.type === "inputs") {
      this.machine?.setInputs(data.inputs);
      this.publish();
      return;
    }
    clearTimeout(this.timer);
    try {
      if (data.type === "start") {
        this.machine = new Machine(data.hex, data.lcd);
        this.machine.setInputs(data.inputs || {});
        this.publish();
      }
      this.running = data.type !== "pause";
      if (this.running) {
        this.nextTick = performance.now();
        this.tick();
      } else this.publish();
    } catch (error) {
      this.running = false;
      this.send({
        type: "error",
        message:
          error instanceof Error ? error.message : "Could not load firmware.",
      });
    }
  }
  dispose() {
    this.running = false;
    clearTimeout(this.timer);
  }
}
