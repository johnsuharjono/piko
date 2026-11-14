import { decodeProject } from "./format";
import { PRESETS } from "../circuit/presets";
import { LESSONS, lessonProject } from "../learning/lessons";
import { parseCircuit, type CircuitDoc } from "../circuit/model";
export type Project = {
  id: string;
  name: string;
  circuit: CircuitDoc;
  sketch: string;
  lessonId?: string;
  updatedAt: number;
};
// A session workspace, intentionally independent of browser disk storage.
// Navigating keeps projects; a reload starts clean. A durable repository can
// replace this boundary later without changing the workbench or catalog.
const projects = new Map<string, Project>();
export function listProjects(): Project[] {
  return [...projects.values()]
    .map((p) => structuredClone(p))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
export function getProject(id: string): Project | null {
  const p = projects.get(id);
  return p ? structuredClone(p) : null;
}
export function saveProject(project: Project) {
  if (
    !project.name.trim() ||
    project.name.length > 80 ||
    !parseCircuit(project.circuit) ||
    typeof project.sketch !== "string" ||
    project.sketch.length > 32000
  )
    throw new Error(
      "Project could not be saved. Check its name, circuit and sketch.",
    );
  const next = { ...structuredClone(project), updatedAt: Date.now() };
  projects.set(next.id, next);
  return structuredClone(next);
}
export function createProject(presetId = "empty", guided = false): Project {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error("This example does not exist.");
  const lesson = guided
    ? LESSONS.find((l) => l.preset === presetId)
    : undefined;
  const initial = lesson
    ? lessonProject(lesson)
    : { doc: preset.create(), sketch: preset.sketch };
  return saveProject({
    id: crypto.randomUUID(),
    name:
      lesson?.title || (presetId === "empty" ? "Untitled bench" : preset.label),
    circuit: initial.doc,
    sketch: initial.sketch,
    lessonId: lesson?.id,
    updatedAt: Date.now(),
  });
}

export function importProject(text: string): Project {
  const content = decodeProject(text);
  return saveProject({
    ...content,
    lessonId: LESSONS.some((l) => l.id === content.lessonId)
      ? content.lessonId
      : undefined,
    id: crypto.randomUUID(),
    updatedAt: Date.now(),
  });
}
