import { betterAuth } from "better-auth/minimal";
import { anonymous } from "better-auth/plugins";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import authConfig from "./auth.config";
import { components, internal } from "./_generated/api";
import { query } from "./_generated/server";
import type { DataModel } from "./_generated/dataModel";
export const authComponent = createClient<DataModel>(components.betterAuth);
export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: process.env.SITE_URL!,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [process.env.SITE_URL!],
    database: authComponent.adapter(ctx),
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    socialProviders:
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
        ? {
            github: {
              clientId: process.env.GITHUB_CLIENT_ID,
              clientSecret: process.env.GITHUB_CLIENT_SECRET,
            },
          }
        : {},
    plugins: [
      anonymous({
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          if (!("runMutation" in ctx))
            throw new Error(
              "Account linking requires a mutation-capable context.",
            );
          await ctx.runMutation(internal.projects.transferOwnership, {
            from: anonymousUser.user.id,
            to: newUser.user.id,
          });
        },
      }),
      convex({ authConfig }),
    ],
  });
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    return user
      ? {
          id: user._id,
          name: user.name,
          anonymous: !!user.isAnonymous,
          githubEnabled:
            !!process.env.GITHUB_CLIENT_ID &&
            !!process.env.GITHUB_CLIENT_SECRET,
        }
      : null;
  },
});
