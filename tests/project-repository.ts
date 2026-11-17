// Explicit test repository. Production never falls back to in-memory saving.
import {
  createProject as template,
  importProject as fromFile,
} from "../apps/web/src/projects/store";
import {
  projectContent,
  validateContent,
  type Project,
  type ProjectContent,
} from "@piko/project-model";
import type { ProjectsService } from "../apps/web/src/projects/provider";
import { ProjectDraft } from "../apps/web/src/projects/draft";
const projects = new Map<string, Project>();
export const listProjects = () =>
  [...projects.values()]
    .map((p) => structuredClone(p))
    .sort((a, b) => b.updatedAt - a.updatedAt);
export const getProject = (id: string) =>
  structuredClone(projects.get(id) || null);
export function saveProject(p: Project) {
  validateContent(projectContent(p));
  if (!p.name.trim()) throw new Error("Invalid name");
  const next = { ...structuredClone(p), updatedAt: Date.now() };
  projects.set(p.id, next);
  return structuredClone(next);
}
export const createProject = (preset = "empty", guided = false) =>
  saveProject({ ...template(preset, guided), revision: 1 });
export const importProject = (text: string) =>
  saveProject({ ...fromFile(text), revision: 1 });
const recovery = {
  read: async () => null,
  write: async () => {},
  remove: async () => {},
};
export const testProjects: ProjectsService = {
  status: "ready",
  error: "",
  connected: true,
  viewer: {
    id: "test-owner",
    name: "Test",
    anonymous: true,
    githubEnabled: false,
  },
  get projects() {
    return listProjects();
  },
  create: async (content: ProjectContent) => {
    const now = Date.now();
    return saveProject({
      ...content,
      id: crypto.randomUUID(),
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });
  },
  remove: async (p) => {
    projects.delete(p.id);
  },
  open: async (id) => {
    const p = getProject(id);
    return p
      ? new ProjectDraft(
          p,
          "test-owner",
          async (args) => {
            const current = getProject(id);
            if (!current) return { status: "missing" };
            if (current.revision !== args.expectedRevision)
              return { status: "conflict", project: current };
            return {
              status: "saved",
              project: saveProject({
                ...current,
                ...args.content,
                revision: current.revision + 1,
              }),
            };
          },
          recovery,
        )
      : null;
  },
  forget: () => {},
  watch: () => () => {},
  flush: async () => true,
  retry: () => {},
  signIn: async () => {},
  signOut: async () => {},
};
export const clearProjects = () => projects.clear();
