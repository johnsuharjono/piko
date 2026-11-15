import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
const image = process.argv[2] || "piko-compiler:local";
const name = `piko-check-${randomBytes(4).toString("hex")}`;
const token = randomBytes(32).toString("hex");
const docker = (args, options = {}) => (execFileSync("docker", args, { encoding: "utf8", ...options }) || "").trim();
let started = false;
try {
  docker(["run", "--rm", "-d", "--name", name, "--memory=512m", "--cpus=1", "--pids-limit=64", "--read-only", "--tmpfs", "/tmp:size=192m,mode=1777", "--cap-drop=ALL", "--security-opt=no-new-privileges:true", "-e", "COMPILER_TOKEN", "-p", "127.0.0.1::3001", image], { env: { ...process.env, COMPILER_TOKEN: token } });
  started = true;
  const port = docker(["port", name, "3001/tcp"]).split(":").at(-1);
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${origin}/healthz`)).ok) { ready = true; break; } } catch {}
    await setTimeout(100);
  }
  if (!ready) throw new Error("Container did not become healthy.");
  const denied = await fetch(`${origin}/compile`, { method: "POST", body: "{}" });
  if (denied.status !== 401) throw new Error("Unauthenticated compilation was not rejected.");
  for (const [file, variable] of [["apps/web/src/lib/examples.ts", "STARTER"], ["apps/web/src/circuit/presets.ts", "COUNTER_SKETCH"]]) {
    const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    const source = text.match(new RegExp("export const " + variable + " = `([\\s\\S]*?)`;"))?.[1];
    if (!source) throw new Error(`Missing fixture ${variable}`);
    const start = performance.now();
    const response = await fetch(`${origin}/compile`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ sketch: source }), signal: AbortSignal.timeout(55_000) });
    const result = await response.json();
    if (!response.ok || !result.ok || !result.hex?.trim().endsWith(":00000001FF")) throw new Error(result.message || "Invalid firmware response.");
    console.log(`${variable}: compiled successfully (${((performance.now() - start) / 1000).toFixed(2)}s)`);
  }
  console.log("Image passed: authenticated builds, read-only filesystem, 512 MiB memory and one CPU.");
} finally {
  if (started) docker(["stop", name], { stdio: "ignore" });
}
