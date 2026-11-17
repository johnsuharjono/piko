// Optional integration check against the isolated development backend, through
// the actual same-origin Better Auth proxy. Cookies/tokens stay in memory.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(
  new URL("../apps/backend/package.json", import.meta.url),
);
const { ConvexHttpClient } = require("convex/browser");
const { anyApi } = require("convex/server");
const env = Object.fromEntries(
  (
    await readFile(
      new URL("../apps/backend/.env.local", import.meta.url),
      "utf8",
    )
  )
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).split(" #")[0]];
    }),
);
assert(
  env.CONVEX_DEPLOYMENT?.startsWith("dev:"),
  "Run this check against a development deployment only.",
);
const origin = "http://127.0.0.1:3000";
function browser() {
  const cookies = new Map();
  return async (path, body) => {
    const headers = {
      Origin: origin,
      Cookie: [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const r = await fetch(`${origin}/api/auth/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const value of r.headers.getSetCookie()) {
      const [part] = value.split(";");
      const i = part.indexOf("=");
      cookies.set(part.slice(0, i), part.slice(i + 1));
    }
    const json = await r.json();
    assert(
      r.ok,
      `Auth ${path} failed (${r.status}): ${json.message || "unknown error"}`,
    );
    return json;
  };
}
const first = browser(),
  second = browser();
let id, client;
try {
  const guest = await first("sign-in/anonymous", {});
  assert(guest.user.isAnonymous);
  const auth = await first("convex/token");
  assert(auth.token);
  client = new ConvexHttpClient(env.CONVEX_URL);
  client.setAuth(auth.token);
  assert.equal((await client.query(anyApi.auth.viewer, {})).id, guest.user.id);
  const content = {
    schemaVersion: 1,
    name: "Integration test — disposable",
    sketch: "void setup(){} void loop(){}",
    circuit: {
      version: 1,
      uno: { x: 80, y: 200 },
      breadboards: [],
      parts: [],
      wires: [],
    },
  };
  const project = await client.mutation(anyApi.projects.create, {
    content,
    creationKey: crypto.randomUUID(),
  });
  id = project.id;
  const edited = {
    ...content,
    name: "Reloaded successfully",
    sketch:
      "void setup(){pinMode(13,OUTPUT);} void loop(){digitalWrite(13,HIGH);}",
    circuit: { ...content.circuit, uno: { x: 240, y: 120 } },
  };
  const result = await client.mutation(anyApi.projects.save, {
    id,
    content: edited,
    expectedRevision: 1,
    mutationId: crypto.randomUUID(),
  });
  assert.equal(result.status, "saved");
  // A new client and session lookup simulate a full page reload.
  const restoredSession = await first("get-session");
  assert.equal(restoredSession.user.id, guest.user.id);
  const reloaded = new ConvexHttpClient(env.CONVEX_URL);
  reloaded.setAuth((await first("convex/token")).token);
  const restored = await reloaded.query(anyApi.projects.get, { id });
  assert.equal(restored.name, edited.name);
  assert.equal(restored.sketch, edited.sketch);
  assert.deepEqual(restored.circuit, edited.circuit);
  assert.equal(restored.revision, 2);
  await second("sign-in/anonymous", {});
  const stranger = new ConvexHttpClient(env.CONVEX_URL);
  stranger.setAuth((await second("convex/token")).token);
  assert.equal(await stranger.query(anyApi.projects.get, { id }), null);
  console.log(
    "Development integration passed: guest cookie restoration, real authenticated saves, fresh-client reload of code/wiring, and cross-owner access isolation.",
  );
} finally {
  if (id && client) {
    const p = await client.query(anyApi.projects.get, { id });
    if (p)
      await client.mutation(anyApi.projects.remove, {
        id,
        expectedRevision: p.revision,
      });
  }
  for (const agent of [first, second]) {
    try {
      await agent("delete-anonymous-user", {});
    } catch {
      console.log(
        "A disposable development guest session may remain for cleanup.",
      );
    }
  }
}
