import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export default defineSchema({
  projects: defineTable({
    ownerId: v.string(),
    creationKey: v.string(),
    content: v.any(),
    revision: v.number(),
    lastMutationId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_updated", ["ownerId", "updatedAt"])
    .index("by_owner_creation", ["ownerId", "creationKey"]),
});
