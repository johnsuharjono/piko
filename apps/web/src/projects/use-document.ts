import { useCallback, useRef, useState } from "react";
import {
  projectContent,
  type Project,
  type ProjectContent,
} from "@piko/project-model";
import { initialContent } from "./store";
// Persistent fields enter one immutable document synchronously in event
// handlers. Effects are for simulation/view synchronization, never autosaving.
export function useProjectDocument(
  project?: Project,
  onChange?: (project: Project) => void,
) {
  const [document, setDocument] = useState<ProjectContent>(() =>
    project
      ? projectContent(project)
      : { ...initialContent("blink"), name: "Your bench" },
  );
  const current = useRef(document),
    projectRef = useRef(project),
    callback = useRef(onChange);
  projectRef.current = project;
  callback.current = onChange;
  const updateDocument = useCallback((patch: Partial<ProjectContent>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    setDocument(next);
    if (projectRef.current)
      callback.current?.({ ...projectRef.current, ...next });
  }, []);
  return { document, updateDocument };
}
