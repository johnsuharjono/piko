// Uses only the published tool artifacts and Uno headers/objects, not the
// upstream application/build driver. No native compiler is needed by this step.
import { createRequire } from "node:module";
import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  readdir,
  stat,
  rm,
  cp,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
const require = createRequire(
  new URL("../packages/browser-compiler/package.json", import.meta.url),
);
const pkg = dirname(require.resolve("@horang-corp/avr-gcc-wasm/package.json"));
const vendor = resolve("packages/browser-compiler/vendor/LiquidCrystal");
const assets = join(pkg, "assets");
const manifest = JSON.parse(
  await readFile(join(assets, "manifest.json"), "utf8"),
);
const pack = {
  headers: {},
  link: {},
  lcdSource: await readFile(join(vendor, "LiquidCrystal.cpp"), "utf8"),
};
for (const path of manifest.headerFiles.filter(
  (p) =>
    (p.startsWith("/sysroot/") &&
      (!/\/avr\/io[^/]+\.h$/.test(p) || p.endsWith("/iom328p.h"))) ||
    p.startsWith("/arduino/core/") ||
    p.startsWith("/arduino/variant/"),
))
  pack.headers[path] = (await readFile(join(assets, "fs", path))).toString(
    "base64",
  );
pack.headers["/libraries/LiquidCrystal/LiquidCrystal.h"] = (
  await readFile(join(vendor, "LiquidCrystal.h"))
).toString("base64");
for (const path of [
  ...manifest.objectGroups.base.filter((p) => p.startsWith("/objects/core_")),
  "/objects/core_abi.o",
  ...manifest.libs,
  "/ldscripts/avr5.xn",
])
  pack.link[path] = (await readFile(join(assets, path))).toString("base64");
const content = JSON.stringify(pack);
const hash = createHash("sha256").update(content);
const tools = await readdir(join(pkg, "tools"));
for (const file of tools.sort())
  hash.update(await readFile(join(pkg, "tools", file)));
const version = hash.digest("hex").slice(0, 16);
const publicRoot = resolve("apps/web/.wasm-public");
await rm(publicRoot, { recursive: true, force: true });
await cp(resolve("apps/web/public"), publicRoot, { recursive: true });
const root = join(publicRoot, "compiler");
const dest = join(root, version);
await mkdir(join(dest, "tools"), { recursive: true });
await writeFile(join(dest, "uno.json"), content);
for (const file of tools)
  await copyFile(join(pkg, "tools", file), join(dest, "tools", file));
await copyFile(
  resolve("packages/browser-compiler/THIRD_PARTY_NOTICES.md"),
  join(dest, "THIRD_PARTY_NOTICES.md"),
);
await writeFile(
  join(root, "manifest.json"),
  JSON.stringify({ assetsBase: `/compiler/${version}/` }),
);
const existingHeaders = await readFile(join(publicRoot, "_headers"), "utf8").catch(() => "");
await writeFile(join(publicRoot, "_headers"), `${existingHeaders}
/compiler/${version}/*
  Cache-Control: public, max-age=31536000, immutable
/compiler/manifest.json
  Cache-Control: no-cache
`);
const files = [
  join(dest, "uno.json"),
  ...tools.map((f) => join(dest, "tools", f)),
];
let total = 0;
for (const file of files) {
  const bytes = await readFile(file);
  if ((await stat(file)).size > 25 * 1024 * 1024)
    throw new Error(`${file} exceeds Cloudflare's per-file limit.`);
  total += bytes.length;
}
console.log(
  `Browser compiler prepared: ${(total / 1048576).toFixed(2)} MiB raw; ${files.length} runtime files.`,
);
