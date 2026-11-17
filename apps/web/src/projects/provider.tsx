import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConvexReactClient, useConvexAuth } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { api } from "@piko/backend/api";
import { authClient } from "../auth/client";
import { ProjectDraft, type SaveResult } from "./draft";
import { recoveryStore } from "./recovery";
import type {
  Project,
  ProjectContent,
  ProjectSummary,
} from "@piko/project-model";
export type Viewer = {
  id: string;
  name: string;
  anonymous: boolean;
  githubEnabled: boolean;
};
export interface ProjectsService {
  status: "connecting" | "ready" | "error" | "unconfigured";
  error: string;
  connected: boolean;
  viewer: Viewer | null;
  projects: ProjectSummary[] | undefined;
  create(content: ProjectContent): Promise<Project>;
  remove(project: ProjectSummary): Promise<void>;
  forget(id: string): void;
  open(id: string): Promise<ProjectDraft | null>;
  watch(
    id: string,
    onProject: (project: Project | null) => void,
    onError: (error: Error) => void,
  ): () => void;
  flush(): Promise<boolean>;
  retry(): void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}
const unavailable = async () => {
  throw new Error("Project saving is not configured.");
};
const unconfigured: ProjectsService = {
  status: "unconfigured",
  error: "Project saving is not configured on this deployment.",
  connected: false,
  viewer: null,
  projects: undefined,
  create: unavailable,
  remove: unavailable,
  forget: () => {},
  open: unavailable,
  watch: () => () => {},
  flush: async () => true,
  retry: () => {},
  signIn: unavailable,
  signOut: unavailable,
};
export const ProjectsContext = createContext<ProjectsService>(unconfigured);
export const useProjects = () => useContext(ProjectsContext);
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const url = typeof __PIKO_CONVEX_URL__ === "undefined" ? "" : __PIKO_CONVEX_URL__;
  const [client] = useState(() =>
    url ? new ConvexReactClient(url, { unsavedChangesWarning: false }) : null,
  );
  useEffect(
    () => () => {
      void client?.close();
    },
    [client],
  );
  if (!client)
    return (
      <ProjectsContext.Provider value={unconfigured}>
        {children}
      </ProjectsContext.Provider>
    );
  return (
    <ConvexBetterAuthProvider client={client} authClient={authClient}>
      <CloudProjects client={client}>{children}</CloudProjects>
    </ConvexBetterAuthProvider>
  );
}
function CloudProjects({
  client,
  children,
}: {
  client: ConvexReactClient;
  children: ReactNode;
}) {
  const session = authClient.useSession();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>();
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [retry, setRetry] = useState(0);
  const signingIn = useRef(false);
  const drafts = useRef(new Map<string, Promise<ProjectDraft | null>>());
  const visibleViewer = viewer?.id === session.data?.user.id ? viewer : null;
  const visibleProjects = visibleViewer ? projects : undefined;
  const owner = visibleViewer?.id;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  useEffect(
    () =>
      client.subscribeToConnectionState((state) =>
        setConnected(state.isWebSocketConnected),
      ),
    [client],
  );
  useEffect(() => {
    if (session.isPending || session.data || signingIn.current) return;
    if (session.error) {
      setError(
        "Could not restore your session. Check your connection and reconnect.",
      );
      return;
    }
    signingIn.current = true;
    void authClient.signIn
      .anonymous()
      .then((result) => {
        if (result.error)
          setError(result.error.message || "Could not start a guest session.");
      })
      .catch(() =>
        setError("Could not connect. Check your connection and retry."),
      )
      .finally(() => {
        signingIn.current = false;
      });
  }, [session.isPending, session.data, session.error, retry]);
  useEffect(() => {
    if (!isAuthenticated) {
      setViewer(null);
      setProjects(undefined);
      return;
    }
    const viewerWatch = client.watchQuery(api.auth.viewer, {}),
      listWatch = client.watchQuery(api.projects.list, {});
    const updateViewer = () => {
      try {
        const v = viewerWatch.localQueryResult();
        if (v !== undefined) {
          setViewer(v);
          setError("");
        }
      } catch {
        setError("Your session could not be restored. Reconnect to continue.");
      }
    };
    const updateList = () => {
      try {
        const p = listWatch.localQueryResult();
        if (p !== undefined) setProjects(p);
      } catch {
        setError("Could not load your projects. Reconnect to retry.");
      }
    };
    const stopViewer = viewerWatch.onUpdate(updateViewer),
      stopList = listWatch.onUpdate(updateList);
    updateViewer();
    updateList();
    return () => {
      stopViewer();
      stopList();
    };
  }, [client, isAuthenticated, retry]);
  useEffect(() => {
    const registry = drafts.current;
    return () => {
      for (const draft of registry.values())
        void draft.then((d) => d?.dispose());
      registry.clear();
    };
  }, [owner]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      for (const draft of activeDrafts.current)
        if (draft.dirty) {
          event.preventDefault();
          event.returnValue = "";
          return;
        }
    };
    const online = () => {
      for (const draft of activeDrafts.current) void draft.flush();
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("online", online);
    };
  }, []);
  const activeDrafts = useRef(new Set<ProjectDraft>());
  useEffect(() => () => activeDrafts.current.clear(), [owner]);
  const service = useMemo<ProjectsService>(() => {
    const ready = () => {
      if (!owner)
        throw new Error(
          "Still connecting your session. Please retry in a moment.",
        );
    };
    const flush = async () => {
      const ds = [...activeDrafts.current];
      await Promise.all(ds.map((d) => d.flush()));
      return ds.every((d) => !d.dirty);
    };
    const forget = (id: string) => {
      const promise = drafts.current.get(id);
      drafts.current.delete(id);
      void promise?.then((draft) => {
        if (!draft) return;
        draft.discardRecovery();
        draft.dispose();
        activeDrafts.current.delete(draft);
      });
    };
    return {
      status: error
        ? "error"
        : !isLoading &&
            isAuthenticated &&
            visibleViewer &&
            visibleProjects !== undefined
          ? "ready"
          : "connecting",
      error,
      connected,
      viewer: visibleViewer,
      projects: visibleProjects,
      create: async (content) => {
        ready();
        return client.mutation(api.projects.create, {
          content,
          creationKey: crypto.randomUUID(),
        });
      },
      remove: async (p) => {
        ready();
        await client.mutation(api.projects.remove, {
          id: p.id,
          expectedRevision: p.revision,
        });
        forget(p.id);
      },
      forget,
      open: async (id) => {
        ready();
        let promise = drafts.current.get(id);
        if (!promise) {
          promise = (async () => {
            const p = await client.query(api.projects.get, { id });
            if (!p || ownerRef.current !== owner) return null;
            const draft = new ProjectDraft(
              p,
              owner!,
              (args) =>
                client.mutation(api.projects.save, args) as Promise<SaveResult>,
              recoveryStore,
            );
            await draft.recover();
            if (ownerRef.current !== owner) {
              draft.dispose();
              return null;
            }
            activeDrafts.current.add(draft);
            return draft;
          })();
          drafts.current.set(id, promise);
          promise.catch(() => drafts.current.delete(id));
        }
        return promise;
      },
      watch: (id, onProject, onError) => {
        const watch = client.watchQuery(api.projects.get, { id });
        const update = () => {
          try {
            const p = watch.localQueryResult();
            if (p !== undefined) onProject(p);
          } catch (e) {
            onError(
              e instanceof Error
                ? e
                : new Error("Could not refresh the project."),
            );
          }
        };
        const stop = watch.onUpdate(update);
        update();
        return stop;
      },
      flush,
      retry: () => {
        setError("");
        setRetry((n) => n + 1);
        void authClient.getSession({ fetchOptions: { cache: "no-store" } });
      },
      signIn: async () => {
        if (!connected) throw new Error("Reconnect before signing in.");
        if (!(await flush()))
          throw new Error(
            "Save or resolve your open changes before signing in.",
          );
        const result = await authClient.signIn.social({
          provider: "github",
          callbackURL: window.location.href,
        });
        if (result.error)
          throw new Error(
            result.error.message || "Could not sign in with GitHub.",
          );
      },
      signOut: async () => {
        if (!connected)
          throw new Error(
            "Reconnect before signing out, so your changes can be saved.",
          );
        if (!(await flush()))
          throw new Error(
            "Save or resolve your open changes before signing out.",
          );
        const result = await authClient.signOut();
        if (result.error)
          throw new Error(result.error.message || "Could not sign out.");
      },
    };
  }, [
    client,
    owner,
    error,
    connected,
    visibleViewer,
    visibleProjects,
    isLoading,
    isAuthenticated,
  ]);
  return (
    <ProjectsContext.Provider value={service}>
      {children}
    </ProjectsContext.Provider>
  );
}
