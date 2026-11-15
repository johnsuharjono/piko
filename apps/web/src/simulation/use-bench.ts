import { useCallback, useEffect, useRef, useState } from "react";
import { INITIAL, type Snapshot, type DigitalInputs } from "./machine";
import type { Command, Reply } from "./protocol";
import { isCompileResult } from "@piko/compile-contract";
export type Status = "idle" | "compiling" | "running" | "paused" | "error";
export function useBench() {
  const [snapshot, setSnapshot] = useState<Snapshot>(INITIAL);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState(
    "Ready when you are. Run the sketch to bring this circuit to life.",
  );
  const [compiledSource, setCompiledSource] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const inputRef = useRef<DigitalInputs>({});
  const setInputs = useCallback((inputs: DigitalInputs) => {
    inputRef.current = inputs;
    worker.current?.postMessage({ type: "inputs", inputs } satisfies Command);
  }, []);
  useEffect(
    () => () => {
      request.current?.abort();
      worker.current?.terminate();
      generation.current++;
    },
    [],
  );
  const command = (data: Command) => worker.current?.postMessage(data);
  const reset = useCallback(() => {
    generation.current++;
    request.current?.abort();
    worker.current?.terminate();
    worker.current = null;
    setSnapshot(INITIAL);
    setStatus("idle");
    setCompiledSource(null);
    setMessage(
      "Reset complete. Digital pins are inputs. Your sketch and wiring are unchanged.",
    );
  }, []);
  const run = useCallback(
    async (source: string, lcd?: import("./lcd").LcdPins | null) => {
      const id = ++generation.current;
      request.current?.abort();
      worker.current?.terminate();
      worker.current = null;
      const controller = new AbortController();
      request.current = controller;
      setStatus("compiling");
      setMessage("Compiling your sketch for Arduino Uno…");
      try {
        const response = await fetch("/api/compile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sketch: source }),
          signal: controller.signal,
        });
        const result: unknown = await response.json();
        if (!isCompileResult(result)) throw new Error("Invalid compiler response.");
        if (generation.current !== id) return;
        if (!result.ok) {
          setStatus("error");
          setMessage(result.message);
          return;
        }
        const nextWorker = new Worker(new URL("./worker.ts", import.meta.url), {
          type: "module",
        });
        nextWorker.onmessage = ({ data }: MessageEvent<Reply>) => {
          if (generation.current !== id) return;
          if (data.type === "snapshot") setSnapshot(data.snapshot);
          else {
            setStatus("error");
            setMessage(data.message);
          }
        };
        nextWorker.onerror = () => {
          if (generation.current === id) {
            setStatus("error");
            setMessage(
              "The simulation worker stopped unexpectedly. Press Run to restart.",
            );
            nextWorker.terminate();
          }
        };
        worker.current = nextWorker;
        nextWorker.postMessage({
          type: "start",
          hex: result.hex,
          lcd,
          ...(Object.keys(inputRef.current).length
            ? { inputs: inputRef.current }
            : {}),
        } satisfies Command);
        setCompiledSource(source);
        setStatus("running");
        setMessage(
          `Compiled successfully. Running real AVR firmware at a simulated 16 MHz.\n${result.output.trim()}`,
        );
      } catch (error) {
        if (generation.current !== id || controller.signal.aborted) return;
        setStatus("error");
        setMessage(
          `Could not reach the compiler service. Try again in a moment.\n${error instanceof Error ? error.message : ""}`,
        );
      }
    },
    [],
  );
  const pause = () => {
    command({ type: "pause" });
    setStatus("paused");
    setMessage("Paused. Simulation time and pin outputs are held.");
  };
  const resume = () => {
    command({ type: "resume" });
    setStatus("running");
    setMessage("Resumed from the paused state.");
  };
  return {
    snapshot,
    status,
    message,
    compiledSource,
    run,
    reset,
    pause,
    resume,
    setInputs,
  };
}
