import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const vars = new URL("../apps/web/.dev.vars", import.meta.url);
if (!existsSync(vars)) writeFileSync(vars, `COMPILER_URL=http://127.0.0.1:3001\nCOMPILER_TOKEN=${randomBytes(32).toString("hex")}\n`, { mode: 0o600 });
const config = Object.fromEntries(readFileSync(vars, "utf8").split("\n").filter(line => line.trim() && !line.trim().startsWith("#")).map(line => {
  const separator = line.indexOf("=");
  return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2")];
}));
if (!config.COMPILER_TOKEN || config.COMPILER_TOKEN.length < 32) throw new Error("Set a COMPILER_TOKEN of at least 32 characters in apps/web/.dev.vars.");
if (config.COMPILER_URL !== "http://127.0.0.1:3001") throw new Error("pnpm dev runs the local compiler at http://127.0.0.1:3001. Use pnpm dev:web for a remote compiler.");
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
    } catch (error) { if (error.code !== "ESRCH") console.error(error.message); }
  }
  setTimeout(() => process.exit(code), 1200);
}
for (const name of ["backend", "compiler", "web"]) {
  const child = spawn("pnpm", ["--filter", `@piko/${name}`, "dev"], { cwd: root, stdio: "inherit", detached: process.platform !== "win32", env: { ...process.env, ...(name === "compiler" ? { COMPILER_TOKEN: config.COMPILER_TOKEN, PORT: "3001", HOST: "127.0.0.1" } : {}) } });
  children.push(child);
  child.on("error", error => { console.error(error.message); stop(1); });
  child.on("exit", code => stop(code || 0));
}
process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
