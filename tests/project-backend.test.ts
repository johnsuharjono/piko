import { expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../apps/backend/convex/schema";
import { api, internal } from "../apps/backend/convex/_generated/api";
import { initialContent } from "../apps/web/src/projects/store";
vi.mock("../apps/backend/convex/auth", () => ({
  authComponent: {
    safeGetAuthUser: async (ctx: any) => {
      const identity = await ctx.auth.getUserIdentity();
      return identity
        ? { _id: identity.subject, isAnonymous: identity.anonymous !== false }
        : null;
    },
  },
}));
const modules = import.meta.glob("../apps/backend/convex/**/*.ts");
const setup = () => convexTest(schema, modules);
it("requires authentication and isolates project reads, lists, writes and deletion by owner", async () => {
  const t = setup(),
    alice = t.withIdentity({ subject: "alice" }),
    bob = t.withIdentity({ subject: "bob" });
  await expect(t.query(api.projects.list, {})).rejects.toThrow(/session/);
  const p = await alice.mutation(api.projects.create, {
    content: initialContent("counter"),
    creationKey: crypto.randomUUID(),
  });
  expect(await bob.query(api.projects.get, { id: p.id })).toBeNull();
  expect(await bob.query(api.projects.list, {})).toEqual([]);
  expect(
    await bob.mutation(api.projects.save, {
      id: p.id,
      content: initialContent(),
      expectedRevision: 1,
      mutationId: crypto.randomUUID(),
    }),
  ).toEqual({ status: "missing" });
  await bob.mutation(api.projects.remove, { id: p.id, expectedRevision: 1 });
  expect(await alice.query(api.projects.get, { id: p.id })).toMatchObject({
    revision: 1,
  });
});
it("makes retried creates and saves idempotent and rejects stale writes", async () => {
  const t = setup(),
    u = t.withIdentity({ subject: "owner" }),
    creationKey = crypto.randomUUID(),
    content = initialContent("blink");
  const p = await u.mutation(api.projects.create, { content, creationKey });
  expect(
    (await u.mutation(api.projects.create, { content, creationKey })).id,
  ).toBe(p.id);
  const args = {
    id: p.id,
    content: { ...content, name: "First edit" },
    expectedRevision: 1,
    mutationId: crypto.randomUUID(),
  };
  expect(await u.mutation(api.projects.save, args)).toMatchObject({
    status: "saved",
    project: { revision: 2 },
  });
  expect(await u.mutation(api.projects.save, args)).toMatchObject({
    status: "saved",
    project: { revision: 2 },
  });
  expect(
    await u.mutation(api.projects.save, {
      ...args,
      mutationId: crypto.randomUUID(),
    }),
  ).toMatchObject({ status: "conflict", project: { revision: 2 } });
  await expect(
    u.mutation(api.projects.remove, { id: p.id, expectedRevision: 1 }),
  ).rejects.toThrow(/another tab/);
});
it("validates project content on the server before any write", async () => {
  const t = setup(),
    u = t.withIdentity({ subject: "owner" });
  for (const content of [
    { ...initialContent(), name: "" },
    { ...initialContent(), sketch: "x".repeat(32001) },
    { ...initialContent(), circuit: { version: 3 } },
  ])
    await expect(
      u.mutation(api.projects.create, {
        content,
        creationKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow();
  expect(await u.query(api.projects.list, {})).toEqual([]);
});
it("transfers guest projects to a signed-in account without making them publicly accessible", async () => {
  const t = setup(),
    guest = t.withIdentity({ subject: "guest" }),
    account = t.withIdentity({ subject: "account", anonymous: false });
  const p = await guest.mutation(api.projects.create, {
    content: initialContent("lcd"),
    creationKey: crypto.randomUUID(),
  });
  await t.mutation(internal.projects.transferOwnership, {
    from: "guest",
    to: "account",
  });
  expect(await guest.query(api.projects.get, { id: p.id })).toBeNull();
  expect(await account.query(api.projects.get, { id: p.id })).toMatchObject({
    id: p.id,
  });
});
it("bounds anonymous project creation rather than accepting unlimited guest documents", async () => {
  const t = setup(),
    guest = t.withIdentity({ subject: "guest" });
  for (let n = 0; n < 20; n++)
    await guest.mutation(api.projects.create, {
      content: initialContent(),
      creationKey: crypto.randomUUID(),
    });
  await expect(
    guest.mutation(api.projects.create, {
      content: initialContent(),
      creationKey: crypto.randomUUID(),
    }),
  ).rejects.toThrow(/20-project limit/);
  expect(await guest.query(api.projects.list, {})).toHaveLength(20);
});
