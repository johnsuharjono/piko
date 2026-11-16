/// <reference lib="webworker" />
import { compileWithToolchain } from "./engine";
import { loadToolchain } from "./loader";
import type { Request, Reply } from "./types";
const send = (reply: Reply) => postMessage(reply);
onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    send({ type: "progress", phase: "Loading browser compiler…" });
    const chain = await loadToolchain(data.assetsBase);
    const result = await compileWithToolchain(data.sketch, chain, (phase) =>
      send({ type: "progress", phase }),
    );
    send({ type: "result", result });
  } catch (error) {
    send({
      type: "result",
      result: {
        ok: false,
        kind: "toolchain",
        message:
          error instanceof Error
            ? error.message
            : "Could not load the browser compiler. Try Run again.",
      },
    });
  }
};
