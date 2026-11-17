import { createFileRoute } from "@tanstack/react-router";
import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";
async function auth(request: Request) {
  const convexUrl = __PIKO_CONVEX_URL__,
    convexSiteUrl = __PIKO_CONVEX_SITE_URL__;
  if (!convexUrl || !convexSiteUrl)
    return Response.json(
      { message: "Project saving is not configured on this deployment." },
      { status: 503 },
    );
  return convexBetterAuthReactStart({ convexUrl, convexSiteUrl }).handler(
    request,
  );
}
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth(request),
      POST: ({ request }) => auth(request),
    },
  },
});
