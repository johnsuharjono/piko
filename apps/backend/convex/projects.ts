import { v, ConvexError } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { authComponent } from "./auth";
import {
  validateContent,
  type Project,
  type ProjectContent,
} from "@piko/project-model";
async function user(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user)
    throw new ConvexError(
      "Your session has expired. Reconnect to save your work.",
    );
  return user;
}
function asProject(p: Doc<"projects">): Project {
  return {
    ...(p.content as ProjectContent),
    id: p._id,
    revision: p.revision,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
async function owned(ctx: QueryCtx | MutationCtx, id: string, ownerId: string) {
  const key = ctx.db.normalizeId("projects", id);
  const p = key ? await ctx.db.get(key) : null;
  return p?.ownerId === ownerId ? p : null;
}
export const list = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await user(ctx);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_owner_updated", (q) => q.eq("ownerId", viewer._id))
      .order("desc")
      .take(200);
    return projects.map((p) => ({
      id: p._id,
      name: p.content.name as string,
      lessonId: p.content.lessonId as string | undefined,
      revision: p.revision,
      updatedAt: p.updatedAt,
    }));
  },
});
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const p = await owned(ctx, id, (await user(ctx))._id);
    return p ? asProject(p) : null;
  },
});
export const create = mutation({
  args: { content: v.any(), creationKey: v.string() },
  handler: async (ctx, args) => {
    const viewer = await user(ctx);
    const content = validateContent(args.content);
    if (!/^[\w-]{16,80}$/.test(args.creationKey))
      throw new ConvexError("Invalid creation key.");
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_owner_creation", (q) =>
        q.eq("ownerId", viewer._id).eq("creationKey", args.creationKey),
      )
      .unique();
    if (existing) return asProject(existing);
    const limit = viewer.isAnonymous ? 20 : 200;
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_owner_updated", (q) => q.eq("ownerId", viewer._id))
      .take(limit);
    if (projects.length >= limit)
      throw new ConvexError(
        `You have reached the ${limit}-project limit. Export and delete a project to make room.`,
      );
    const now = Date.now();
    const id = await ctx.db.insert("projects", {
      ownerId: viewer._id,
      content,
      creationKey: args.creationKey,
      revision: 1,
      lastMutationId: args.creationKey,
      createdAt: now,
      updatedAt: now,
    });
    return asProject((await ctx.db.get(id))!);
  },
});
export const save = mutation({
  args: {
    id: v.string(),
    content: v.any(),
    expectedRevision: v.number(),
    mutationId: v.string(),
  },
  handler: async (ctx, args) => {
    const p = await owned(ctx, args.id, (await user(ctx))._id);
    if (!p) return { status: "missing" as const };
    if (p.lastMutationId === args.mutationId)
      return { status: "saved" as const, project: asProject(p) };
    const content = validateContent(args.content);
    if (
      !/^[\w-]{16,80}$/.test(args.mutationId) ||
      !Number.isSafeInteger(args.expectedRevision) ||
      args.expectedRevision < 1
    )
      throw new ConvexError("Invalid project revision or save identifier.");
    if (p.revision !== args.expectedRevision)
      return { status: "conflict" as const, project: asProject(p) };
    await ctx.db.patch(p._id, {
      content,
      revision: p.revision + 1,
      lastMutationId: args.mutationId,
      updatedAt: Date.now(),
    });
    return {
      status: "saved" as const,
      project: asProject((await ctx.db.get(p._id))!),
    };
  },
});
export const remove = mutation({
  args: { id: v.string(), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const p = await owned(ctx, args.id, (await user(ctx))._id);
    if (!p) return;
    if (p.revision !== args.expectedRevision)
      throw new ConvexError(
        "This project changed in another tab. Refresh the project list before deleting it.",
      );
    await ctx.db.delete(p._id);
  },
});
export const transferOwnership = internalMutation({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, args) => {
    if (args.from === args.to) return;
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_owner_updated", (q) => q.eq("ownerId", args.from))
      .take(200);
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_owner_updated", (q) => q.eq("ownerId", args.to))
      .take(200);
    if (existing.length + projects.length > 200)
      throw new ConvexError(
        "This account cannot accept more projects. Export your guest projects, then free up space in the account before linking.",
      );
    for (const project of projects)
      await ctx.db.patch(project._id, { ownerId: args.to });
  },
});
