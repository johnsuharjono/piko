import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
const cwd = fileURLToPath(new URL("../apps/backend/", import.meta.url));
function run(args, options = {}) {
  const r = spawnSync("pnpm", ["exec", "convex", ...args], {
    cwd,
    stdio: "inherit",
    ...options,
  });
  if (r.status) throw new Error(`Convex ${args[0]} failed.`);
  return r;
}
// Interactive only on first setup; uses the developer's logged-in account.
run(["dev", "--once"]);
for (const [name, value] of [
  ["SITE_URL", "http://127.0.0.1:3000"],
  ["BETTER_AUTH_SECRET", randomBytes(32).toString("base64")],
]) {
  const current = spawnSync("pnpm", ["exec", "convex", "env", "get", name], {
    cwd,
    encoding: "utf8",
  });
  if (current.status)
    run(["env", "set", name], {
      input: value,
      stdio: ["pipe", "inherit", "inherit"],
    });
}
const vars = Object.fromEntries(
  readFileSync(`${cwd}.env.local`, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).split(" #")[0]];
    }),
);
writeFileSync(
  new URL("../apps/web/.env.local", import.meta.url),
  `VITE_CONVEX_URL=${vars.CONVEX_URL}\nVITE_CONVEX_SITE_URL=${vars.CONVEX_SITE_URL}\n`,
);
console.log("Development backend connected. Run pnpm dev.");
