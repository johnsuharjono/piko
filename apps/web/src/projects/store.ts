import { decodeProject } from "./format";
import { PRESETS } from "../circuit/presets";
import { LESSONS, lessonProject } from "../learning/lessons";
import {
  projectContent,
  type Project,
  type ProjectContent,
} from "@piko/project-model";
export type { Project, ProjectContent } from "@piko/project-model";
// Templates create content only. A repository assigns identity and acknowledges
// persistence; there is deliberately no module-global project cache here.
export function initialContent(
  presetId = "empty",
  guided = false,
): ProjectContent {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error("This example does not exist.");
  const lesson = guided
    ? LESSONS.find((l) => l.preset === presetId)
    : undefined;
  const initial = lesson
    ? lessonProject(lesson)
    : { doc: preset.create(), sketch: preset.sketch };
  return projectContent({
    name:
      lesson?.title || (presetId === "empty" ? "Untitled bench" : preset.label),
    circuit: initial.doc,
    sketch: initial.sketch,
    lessonId: lesson?.id,
  });
}
// Unsaved fixtures/portable imports, not a persistence API.
export function createProject(presetId = "empty", guided = false): Project {
  const now = Date.now();
  return {
    ...initialContent(presetId, guided),
    id: crypto.randomUUID(),
    revision: 0,
    createdAt: now,
    updatedAt: now,
  };
}
export function importProject(text: string): Project {
  const content = decodeProject(text),
    now = Date.now();
  return {
    ...projectContent(content),
    id: crypto.randomUUID(),
    revision: 0,
    createdAt: now,
    updatedAt: now,
  };
}
