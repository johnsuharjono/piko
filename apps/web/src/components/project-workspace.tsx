import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useProjects } from "../projects/provider";
import { ProjectDraft } from "../projects/draft";
import { projectContent } from "@piko/project-model";
import { downloadProject } from "../projects/format";
import { Button } from "./ui/button";
import { Bench } from "./bench";
export function ProjectWorkspace({ id }: { id: string }) {
  const services = useProjects();
  return (
    <ProjectLoader
      key={`${services.viewer?.id || "no-session"}:${id}`}
      id={id}
    />
  );
}
function ProjectLoader({ id }: { id: string }) {
  const services = useProjects();
  const [draft, setDraft] = useState<ProjectDraft | null>();
  const [error, setError] = useState("");
  const owner = services.viewer?.id;
  useEffect(() => {
    if (services.status !== "ready") return;
    let active = true;
    void services
      .open(id)
      .then((p) => {
        if (active) setDraft(p);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "Could not open this project.",
          );
      });
    return () => {
      active = false;
    };
  }, [id, owner, services.status]);
  if (draft) return <OpenProject draft={draft} />;
  if (
    error ||
    services.status === "error" ||
    services.status === "unconfigured"
  )
    return (
      <main className="session-empty">
        <h1>Could not open your project</h1>
        <p role="alert">{error || services.error}</p>
        <Button
          onClick={() => {
            setError("");
            services.retry();
          }}
        >
          Reconnect
        </Button>
        <Link to="/">Home</Link>
      </main>
    );
  if (draft === null)
    return (
      <main className="session-empty">
        <h1>Project not found</h1>
        <p>It may have been deleted or belong to another account.</p>
        <Link to="/">Your projects</Link>
      </main>
    );
  return (
    <main className="session-empty">
      <p>Opening your project…</p>
    </main>
  );
}
function OpenProject({ draft }: { draft: ProjectDraft }) {
  const services = useProjects(),
    navigate = useNavigate();
  const state = useSyncExternalStore(
    draft.subscribe,
    draft.getSnapshot,
    draft.getSnapshot,
  );
  const [actionError, setActionError] = useState("");
  const [copying, setCopying] = useState(false);
  useEffect(
    () =>
      services.watch(
        state.project.id,
        (p) => {
          setActionError("");
          draft.observe(p);
        },
        (e) => setActionError(e.message),
      ),
    [draft, services.viewer?.id],
  );
  useEffect(
    () => () => {
      void draft.flush();
    },
    [draft],
  );
  const copy = async () => {
    setCopying(true);
    setActionError("");
    try {
      const p = await services.create(
        projectContent({
          ...state.project,
          name: `${state.project.name.slice(0, 70)} (copy)`,
        }),
      );
      services.forget(state.project.id);
      await navigate({ to: "/bench/$projectId", params: { projectId: p.id } });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not save a copy.");
    } finally {
      setCopying(false);
    }
  };
  const blocked = state.phase === "conflict" || state.phase === "missing";
  const label =
    !services.connected && draft.dirty
      ? "Offline · changes queued"
      : (
          {
            saved: "Saved",
            pending: "Unsaved changes",
            saving: "Saving…",
            error: "Save failed",
            conflict: "Save conflict",
            missing: "Project unavailable",
          } as const
        )[state.phase];
  return (
    <div className="workspace-shell">
      {(blocked ||
        state.phase === "error" ||
        actionError ||
        (!state.recoveryAvailable && draft.dirty)) && (
        <div className="project-alert" role="alert">
          <span>
            {actionError ||
              state.message ||
              "Browser recovery is unavailable. Keep this tab open until Saved appears, or export your project."}
          </span>
          {state.phase === "error" && (
            <Button size="sm" onClick={() => void draft.flush()}>
              Retry save
            </Button>
          )}
          {state.phase === "conflict" && (
            <Button size="sm" variant="outline" onClick={draft.useSavedVersion}>
              Use saved version
            </Button>
          )}
          {blocked && (
            <Button
              size="sm"
              disabled={copying || services.status !== "ready"}
              onClick={() => void copy()}
            >
              {copying ? "Saving copy…" : "Save my edits as a copy"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => downloadProject(state.project)}
          >
            Export draft
          </Button>
        </div>
      )}
      <Bench
        key={`${state.project.id}:${state.epoch}`}
        project={state.project}
        onProjectChange={draft.update}
        saveLabel={label}
        savePhase={state.phase}
      />
    </div>
  );
}
