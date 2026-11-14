/// <reference lib="webworker" />
import { SimulationRuntime } from "./runtime";
import type { Command } from "./protocol";
const runtime = new SimulationRuntime((reply) => postMessage(reply));
onmessage = ({ data }: MessageEvent<Command>) => runtime.handle(data);
