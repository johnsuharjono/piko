import { parseCircuit, type CircuitDoc } from "./circuit";
export type ProjectContent = {
  schemaVersion: 1;
  name: string;
  sketch: string;
  circuit: CircuitDoc;
  lessonId?: string;
};
export type Project = ProjectContent & {
  id: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
};
export type ProjectSummary = Pick<
  Project,
  "id" | "name" | "lessonId" | "updatedAt" | "revision"
>;
export function validateContent(value: unknown): ProjectContent {
  const p = value as ProjectContent;
  if (
    !p ||
    p.schemaVersion !== 1 ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > 80 ||
    typeof p.sketch !== "string" ||
    p.sketch.length > 32000 ||
    (p.lessonId !== undefined &&
      !["blink", "button", "lcd", "counter"].includes(p.lessonId))
  )
    throw new Error("Invalid project name, sketch, or guide.");
  const circuit = parseCircuit(p.circuit);
  if (!circuit || new TextEncoder().encode(JSON.stringify(p)).length > 200000)
    throw new Error("Invalid circuit or project larger than 200 KB.");
  return {
    schemaVersion: 1,
    name: p.name.trim(),
    sketch: p.sketch,
    circuit,
    ...(p.lessonId ? { lessonId: p.lessonId } : {}),
  };
}
export function projectContent(
  p: Pick<ProjectContent, "name" | "sketch" | "circuit" | "lessonId">,
): ProjectContent {
  return {
    schemaVersion: 1,
    name: p.name.trim() || "Untitled bench",
    sketch: p.sketch,
    circuit: p.circuit,
    ...(p.lessonId ? { lessonId: p.lessonId } : {}),
  };
}
export const contentKey = (content: ProjectContent) => JSON.stringify(content);
