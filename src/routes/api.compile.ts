import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { compileSketch, validateSketch } from "../server/compiler";
export const Route = createFileRoute("/api/compile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && origin !== new URL(request.url).origin)
          return Response.json(
            {
              ok: false,
              message: "Compile from the Piko workspace.",
              kind: "request",
            },
            { status: 403 },
          );
        if (Number(request.headers.get("content-length")) > 40000)
          return Response.json(
            { ok: false, message: "Sketch is too large.", kind: "request" },
            { status: 413 },
          );
        try {
          const body = await request.text();
          if (body.length > 40000) throw new Error("Sketch is too large.");
          const sketch = validateSketch(JSON.parse(body));
          return Response.json(
            await Effect.runPromise(compileSketch(sketch), {
              signal: request.signal,
            }),
          );
        } catch {
          return Response.json(
            {
              ok: false,
              message: "Send a sketch between 1 and 32,000 characters.",
              kind: "request",
            },
            { status: 400 },
          );
        }
      },
    },
  },
});
