import { mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(process.env.ARDUINO_HOME || ".arduino");
const bin = join(root, "bin");
await mkdir(bin, { recursive: true });
const platform = { darwin: "macOS", linux: "Linux" }[process.platform];
const arch = { arm64: "ARM64", x64: "64bit" }[process.arch];
if (!platform || !arch)
  throw new Error(
    "Automatic setup supports macOS/Linux ARM64 and x64. Set ARDUINO_CLI to your installed CLI on other systems.",
  );
const response = await fetch(
  "https://api.github.com/repos/arduino/arduino-cli/releases/tags/v1.5.1",
);
if (!response.ok) throw new Error(`Release lookup failed: ${response.status}`);
const release = await response.json();
const suffix = `_${platform}_${arch}.tar.gz`;
const asset = release.assets.find((a) => a.name.endsWith(suffix));
if (!asset) throw new Error(`No Arduino CLI download for ${platform} ${arch}`);
console.log(
  `Installing Arduino CLI ${release.tag_name} in .arduino/ (project-local).`,
);
const download = await fetch(asset.browser_download_url);
if (!download.ok) throw new Error(`Download failed: ${download.status}`);
const bytes = Buffer.from(await download.arrayBuffer());
const checksumAsset = release.assets.find((a) =>
  a.name.endsWith("checksums.txt"),
);
if (!checksumAsset) throw new Error("Release checksums missing");
const checksums = await (
  await fetch(checksumAsset.browser_download_url)
).text();
const expected = checksums
  .split("\n")
  .find((line) => line.trim().endsWith(asset.name))
  ?.split(/\s+/)[0];
const { createHash } = await import("node:crypto");
if (!expected || createHash("sha256").update(bytes).digest("hex") !== expected)
  throw new Error("Arduino CLI checksum mismatch");
const temp = await mkdtemp(join(tmpdir(), "piko-install-"));
try {
  await writeFile(join(temp, "cli.tar.gz"), bytes);
  execFileSync("tar", [
    "-xzf",
    join(temp, "cli.tar.gz"),
    "-C",
    bin,
    "arduino-cli",
  ]);
} finally {
  await rm(temp, { recursive: true, force: true });
}
const config = join(root, "config.json");
await writeFile(
  config,
  JSON.stringify({
    directories: {
      data: join(root, "data"),
      downloads: join(root, "downloads"),
      user: join(root, "user"),
    },
  }),
);
const cli = join(bin, "arduino-cli");
for (const args of [
  ["core", "update-index"],
  ["core", "install", "arduino:avr@1.8.8"],
  ["lib", "install", "LiquidCrystal@1.0.7"],
]) {
  execFileSync(cli, [...args, "--config-file", config], {
    stdio: "inherit",
    timeout: 300000,
  });
}
const { setupNativeAvr } = await import("./setup-native-avr.mjs");
await setupNativeAvr(root);
console.log("Ready. Piko can compile real Arduino Uno sketches.");
