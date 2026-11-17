// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  session: { data: { user: { id: "alice" } }, isPending: false, error: null },
  viewer: { id: "alice", name: "Alice", anonymous: false, githubEnabled: true },
  projects: [
    {
      id: "project-a",
      name: "Alice private project",
      revision: 1,
      updatedAt: 1,
    },
  ],
  listeners: new Set<() => void>(),
}));
vi.mock("../apps/web/src/auth/client", () => ({
  authClient: {
    useSession: () => state.session,
    signIn: { anonymous: vi.fn() },
    getSession: vi.fn(),
  },
}));
vi.mock("@convex-dev/better-auth/react", () => ({
  ConvexBetterAuthProvider: ({ children }: any) => children,
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  ConvexReactClient: class {
    close = vi.fn();
    subscribeToConnectionState = () => () => {};
    watchQuery(reference: any) {
      return {
        localQueryResult: () =>
          String(reference[Symbol.for("functionName")]).includes("auth:viewer")
            ? state.viewer
            : state.projects,
        onUpdate: (cb: () => void) => {
          state.listeners.add(cb);
          return () => state.listeners.delete(cb);
        },
      };
    }
  },
}));
import {
  ProjectsProvider,
  useProjects,
} from "../apps/web/src/projects/provider";
function Probe() {
  const p = useProjects();
  return (
    <output>
      {p.viewer?.name}:
      {p.projects?.map((p) => p.name).join(",") || "no projects"}
    </output>
  );
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  state.listeners.clear();
});
it("hides prior account data immediately while the next identity is still connecting", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("__PIKO_CONVEX_URL__", "https://example.convex.cloud");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <ProjectsProvider>
          <Probe />
        </ProjectsProvider>,
      ),
    );
    expect(host.textContent).toContain("Alice private project");
    state.session = { ...state.session, data: { user: { id: "bob" } } };
    await act(async () =>
      root.render(
        <ProjectsProvider>
          <Probe />
        </ProjectsProvider>,
      ),
    );
    expect(host.textContent).not.toContain("Alice");
    expect(host.textContent).toContain("no projects");
    state.viewer = { ...state.viewer, id: "bob", name: "Bob" };
    state.projects = [];
    await act(async () => {
      for (const cb of state.listeners) cb();
    });
    expect(host.textContent).toBe("Bob:no projects");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
