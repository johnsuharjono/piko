import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
if (!existsSync(new URL("../apps/backend/.env.local", import.meta.url)))
  throw new Error("Connect a development backend first: pnpm setup:backend");
const prepare = spawnSync(
  process.execPath,
  ["scripts/prepare-browser-compiler.mjs"],
  { cwd: root, stdio: "inherit" },
);
if (prepare.status) process.exit(prepare.status || 1);
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    try {
      if (process.platform === "win32") child.kill("SIGTERM");
      else process.kill(-child.pid, "SIGTERM");
    } catch (e) {
      if (e.code !== "ESRCH") console.error(e.message);
    }
  }
  setTimeout(() => process.exit(code), 1200).unref();
}
for (const [app, bin, args] of [
  ["backend", "convex", ["dev"]],
  ["web", "vite", ["--host", "127.0.0.1", "--port", "3000", "--strictPort"]],
]) {
  const child = spawn(`${root}apps/${app}/node_modules/.bin/${bin}`, args, {
    cwd: `${root}apps/${app}`,
    stdio: "inherit",
    detached: process.platform !== "win32",
  });
  children.push(child);
  child.on("error", (e) => {
    console.error(e.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code || 0);
  });
}
process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
