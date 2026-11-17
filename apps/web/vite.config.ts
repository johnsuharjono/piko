import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import production from "../../deploy/convex.json" with { type: "json" };
export default defineConfig(({ mode, command }) => {
  // Build from explicit production URLs, never a developer's .env.local.
  // CI/staging can override both URLs through its process environment.
  const local =
    command === "serve" ? loadEnv(mode, process.cwd(), "VITE_") : {};
  const convexUrl =
    (command === "serve"
      ? process.env.VITE_CONVEX_URL ?? local.VITE_CONVEX_URL
      : process.env.PIKO_BUILD_CONVEX_URL ?? production.convexUrl);
  const convexSiteUrl =
    (command === "serve"
      ? process.env.VITE_CONVEX_SITE_URL ?? local.VITE_CONVEX_SITE_URL
      : process.env.PIKO_BUILD_CONVEX_SITE_URL ?? production.convexSiteUrl);
  return {
    envDir: command === "build" ? false : undefined,
    ssr: { noExternal: ["@convex-dev/better-auth"] },
    define: {
      "__PIKO_CONVEX_URL__": JSON.stringify(convexUrl || ""),
      "__PIKO_CONVEX_SITE_URL__": JSON.stringify(
        convexSiteUrl || "",
      ),
    },
    publicDir:
      process.env.VITE_COMPILER === "native" ? "public" : ".wasm-public",
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    plugins: [
      tailwindcss(),
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tanstackStart(),
      react(),
    ],
  };
});
