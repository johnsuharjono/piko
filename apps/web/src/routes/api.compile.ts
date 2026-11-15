import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { proxyCompile } from "../server/compile-proxy";
export const Route = createFileRoute("/api/compile")({
  server: { handlers: { POST: ({ request }) => proxyCompile(request, env) } },
});
