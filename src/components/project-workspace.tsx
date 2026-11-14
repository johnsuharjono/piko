import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getProject, saveProject, type Project } from "../projects/store";
import { Bench } from "./bench";
export function ProjectWorkspace({ id }: { id: string }) {
  const [state, setState] = useState<{
    loaded: boolean;
    project: Project | null;
  }>({ loaded: false, project: null });
  useEffect(() => {
    setState({ loaded: true, project: getProject(id) });
  }, [id]);
  if (!state.loaded)
    return (
      <main className="session-empty">
        <p>Opening your bench…</p>
      </main>
    );
  if (!state.project)
    return (
      <main className="session-empty">
        <h1>This bench is no longer open.</h1>
        <p>Benches belong to the current session. Reloading starts fresh.</p>
        <Link to="/">Return Home</Link>
        <Link to="/learn">Choose a project</Link>
      </main>
    );
  return <Bench key={id} project={state.project} onProjectSave={saveProject} />;
}
