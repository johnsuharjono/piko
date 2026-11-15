import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)), "cloudflare:workers": fileURLToPath(new URL("./tests/cloudflare-env.ts", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
