// Apple Silicon fallback: Arduino's AVR distribution still ships Intel macOS tools.
// Keep compiler binaries project-local. Only their shared libraries come from Homebrew.
import { execFileSync } from "node:child_process";
import {
  mkdir,
  writeFile,
  readFile,
  readdir,
  symlink,
  rm,
  copyFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

export async function setupNativeAvr(root) {
  if (process.platform !== "darwin" || process.arch !== "arm64") return;
  const native = join(root, "native-toolchain");
  const bin = join(root, "native-bin");
  if (
    existsSync(join(bin, "avr-g++")) &&
    existsSync(join(bin, "ctags")) &&
    existsSync(join(bin, "as")) &&
    existsSync(join(bin, "ld"))
  ) {
    try {
      execFileSync(join(bin, "avr-g++"), ["--version"]);
      return;
    } catch {
      /* repair below */
    }
  }
  const version = Number(
    execFileSync("sw_vers", ["-productVersion"], { encoding: "utf8" }).split(
      ".",
    )[0],
  );
  if (version < 15)
    throw new Error(
      "Native Apple Silicon setup needs macOS 15+. Supply an installed toolchain using ARDUINO_COMPILER_PATH on older systems.",
    );
  const tag = version >= 26 ? "tahoe" : "sequoia";
  const brew = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"].find(
    existsSync,
  );
  if (!brew)
    throw new Error(
      "Install Homebrew for the native AVR compiler shared libraries, then rerun setup.",
    );
  console.log(
    "Preparing native ARM64 AVR tools. Homebrew supplies gmp, isl, libmpc, mpfr, and zstd.",
  );
  execFileSync(brew, ["install", "gmp", "isl", "libmpc", "mpfr", "zstd"], {
    stdio: "inherit",
    env: { ...process.env, HOMEBREW_NO_AUTO_UPDATE: "1" },
  });
  const prefix = execFileSync(brew, ["--prefix"], { encoding: "utf8" }).trim();
  await mkdir(native, { recursive: true });
  await mkdir(bin, { recursive: true });
  async function asset(repo, releaseTag, name, destination) {
    const metadata = await fetch(
      `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(releaseTag)}`,
    );
    if (!metadata.ok)
      throw new Error(
        `Could not find ${repo} ${releaseTag}: ${metadata.status}`,
      );
    const release = await metadata.json();
    const file = release.assets.find((a) => a.name === name);
    const expectedDigest =
      file?.digest ||
      (name === "ctags-5.8-arduino11.tar.xz"
        ? "sha512:84e6bbe8a63c2d868c81bb274f78714157666833dc722f2ae2ab559a1adbd5c9e4c6661c6031bae55abe30cc021a972796d72d0c436dd9ffffaeaa7d0337a69e"
        : null);
    if (!expectedDigest)
      throw new Error(`Missing SHA-256 metadata for ${name}`);
    // The asset API also avoids download URL failures on some corporate proxies.
    const response = await fetch(file.url, {
      headers: { Accept: "application/octet-stream" },
    });
    if (!response.ok)
      throw new Error(`Download failed for ${name}: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (
      `${expectedDigest.split(":")[0]}:${createHash(expectedDigest.split(":")[0]).update(bytes).digest("hex")}` !==
      expectedDigest
    )
      throw new Error(`Checksum mismatch: ${name}`);
    await writeFile(destination, bytes);
  }
  for (const [release, name] of [
    ["avr-gcc@14-14.4.0", `avr-gcc@14-14.4.0.arm64_${tag}.bottle.tar.gz`],
    ["avr-binutils-2.47_1", `avr-binutils-2.47_1.arm64_${tag}.bottle.tar.gz`],
  ]) {
    const archive = join(root, name);
    await asset("osx-cross/homebrew-avr", release, name, archive);
    execFileSync("tar", ["-xzf", archive, "-C", native]);
  }
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    return (
      await Promise.all(
        entries.map(async (entry) =>
          entry.isDirectory()
            ? walk(join(directory, entry.name))
            : entry.isFile()
              ? [join(directory, entry.name)]
              : [],
        ),
      )
    ).flat();
  }
  // Homebrew bottles contain relocatable library references; relocate to this host.
  for (const file of await walk(native)) {
    const bytes = await readFile(file);
    if (!bytes.subarray(0, 4).equals(Buffer.from([0xcf, 0xfa, 0xed, 0xfe])))
      continue;
    const libraries = execFileSync("otool", ["-L", file], { encoding: "utf8" })
      .split("\n")
      .slice(1);
    let changed = false;
    for (const line of libraries) {
      const library = line.trim().split(" (")[0];
      if (!library.includes("@@HOMEBREW_PREFIX@@")) continue;
      execFileSync(
        "install_name_tool",
        [
          "-change",
          library,
          library.replaceAll("@@HOMEBREW_PREFIX@@", prefix),
          file,
        ],
        { stdio: "pipe" },
      );
      changed = true;
    }
    if (changed)
      execFileSync("codesign", ["--force", "--sign", "-", file], {
        stdio: "pipe",
      });
  }
  for (const directory of [
    join(native, "avr-binutils/2.47_1/bin"),
    join(native, "avr-gcc@14/14.4.0/bin"),
  ]) {
    for (const name of await readdir(directory)) {
      if (!name.startsWith("avr-")) continue;
      await rm(join(bin, name), { force: true });
      await symlink(join(directory, name), join(bin, name));
    }
  }
  for (const name of ["as", "ld"]) {
    await rm(join(bin, name), { force: true });
    await symlink(join(bin, `avr-${name}`), join(bin, name));
  }
  const source = join(root, "ctags-source");
  await mkdir(source, { recursive: true });
  const archive = join(root, "ctags.tar.xz");
  await asset(
    "arduino/ctags",
    "5.8-arduino11",
    "ctags-5.8-arduino11.tar.xz",
    archive,
  );
  execFileSync("tar", ["-xf", archive, "-C", source, "--strip-components=1"]);
  // The old __unused__ macro collides with modern Apple SDK headers.
  for (const file of await walk(source)) {
    if (!/\.[ch]$/.test(file)) continue;
    const bytes = await readFile(file);
    await writeFile(
      file,
      Buffer.from(
        bytes.toString("latin1").replaceAll("__unused__", "CTAGS_UNUSED"),
        "latin1",
      ),
    );
  }
  execFileSync("./configure", [], { cwd: source, stdio: "pipe" });
  execFileSync("make", ["-j4"], { cwd: source, stdio: "pipe" });
  await copyFile(join(source, "ctags"), join(bin, "ctags"));
  execFileSync(join(bin, "avr-g++"), ["--version"], { stdio: "inherit" });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve("scripts/setup-native-avr.mjs")
) {
  await setupNativeAvr(resolve(".arduino"));
}
