import {
  contentKey,
  projectContent,
  type Project,
  type ProjectContent,
} from "@piko/project-model";
import { projectError } from "./errors";
import type { RecoveryStore } from "./recovery";
export type SaveResult =
  | { status: "saved" | "conflict"; project: Project }
  | { status: "missing" };
export type DraftState = {
  project: Project;
  phase: "saved" | "pending" | "saving" | "error" | "conflict" | "missing";
  epoch: number;
  message: string;
  recoveryAvailable: boolean;
};
export type Save = (args: {
  id: string;
  content: ProjectContent;
  expectedRevision: number;
  mutationId: string;
}) => Promise<SaveResult>;
export class ProjectDraft {
  private baseline: Project;
  private state: DraftState;
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private attempt?: Parameters<Save>[0];
  private latestRemote?: Project | null;
  private journal = Promise.resolve();
  private journalGeneration = 0;
  private recoveryRevision: number;
  private disposed = false;
  constructor(
    project: Project,
    private owner: string,
    private save: Save,
    private recovery: RecoveryStore,
  ) {
    this.baseline = project;
    this.recoveryRevision = project.revision;
    this.state = {
      project,
      phase: "saved",
      epoch: 0,
      message: "",
      recoveryAvailable: true,
    };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  get dirty() {
    return (
      contentKey(projectContent(this.state.project)) !==
      contentKey(projectContent(this.baseline))
    );
  }
  private emit(patch: Partial<DraftState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  private persist() {
    const generation = ++this.journalGeneration;
    const content = projectContent(this.state.project),
      baseRevision = this.recoveryRevision;
    const dirty = this.dirty;
    this.journal = this.journal
      .then(() =>
        generation !== this.journalGeneration
          ? undefined
          : dirty
            ? this.recovery.write({
                ownerId: this.owner,
                id: this.baseline.id,
                baseRevision,
                content,
              })
            : this.recovery.remove(this.owner, this.baseline.id),
      )
      .catch(() => {
        this.emit({ recoveryAvailable: false });
      });
  }
  async recover() {
    try {
      const r = await this.recovery.read(this.owner, this.baseline.id);
      if (!r) return;
      if (contentKey(r.content) === contentKey(projectContent(this.baseline))) {
        this.persist();
        return;
      }
      this.recoveryRevision = r.baseRevision;
      this.emit({
        project: { ...this.baseline, ...r.content },
        epoch: this.state.epoch + 1,
        phase:
          r.baseRevision === this.baseline.revision ? "pending" : "conflict",
        message:
          r.baseRevision === this.baseline.revision
            ? "Recovered unsaved changes."
            : "Recovered edits differ from the saved project. Choose which version to keep.",
      });
      if (this.state.phase === "pending") this.schedule();
    } catch {
      this.emit({ recoveryAvailable: false });
    }
  }
  update = (project: Project) => {
    const content = projectContent(project);
    if (contentKey(content) === contentKey(projectContent(this.state.project)))
      return;
    this.emit({
      project: { ...this.state.project, ...content },
      phase: ["conflict", "missing"].includes(this.state.phase)
        ? this.state.phase
        : this.running
          ? "saving"
          : "pending",
      message: this.state.phase === "conflict" ? this.state.message : "",
    });
    this.persist();
    this.schedule();
  };
  private schedule() {
    clearTimeout(this.timer);
    if (!["conflict", "missing"].includes(this.state.phase))
      this.timer = setTimeout(() => void this.flush(), 650);
  }
  observe = (remote: Project | null) => {
    this.latestRemote = remote;
    if (this.running) return;
    if (!remote) {
      this.emit({
        phase: "missing",
        message:
          "This project was deleted or is no longer accessible. Your open draft is still available to export or copy.",
      });
      return;
    }
    if (remote.revision <= this.baseline.revision) return;
    if (this.dirty) {
      this.emit({
        phase: "conflict",
        message:
          "This project changed in another tab. Your edits have not been overwritten.",
      });
      return;
    }
    this.baseline = remote;
    this.recoveryRevision = remote.revision;
    this.emit({
      project: remote,
      epoch: this.state.epoch + 1,
      phase: "saved",
      message: "Updated from another tab. Simulation stopped.",
    });
    this.persist();
  };
  flush = (): Promise<void> => {
    clearTimeout(this.timer);
    if (this.running) return this.running;
    if (this.disposed || ["conflict", "missing"].includes(this.state.phase))
      return Promise.resolve();
    this.running = this.drain().finally(() => {
      this.running = undefined;
      if (this.latestRemote !== undefined) this.observe(this.latestRemote);
    });
    return this.running;
  };
  private async drain() {
    while ((this.dirty || this.attempt) && !this.disposed) {
      this.attempt ??= {
        id: this.baseline.id,
        content: projectContent(this.state.project),
        expectedRevision: this.baseline.revision,
        mutationId: crypto.randomUUID(),
      };
      this.emit({ phase: "saving" });
      try {
        const result = await this.save(this.attempt);
        if (result.status === "missing") {
          this.emit({
            phase: "missing",
            message:
              "The project is no longer accessible. Export or save a copy of this draft.",
          });
          return;
        }
        if (result.status === "conflict") {
          this.latestRemote = result.project;
          this.attempt = undefined;
          this.emit({
            phase: "conflict",
            message:
              "This project changed in another tab. Keep the saved version or save your edits as a copy.",
          });
          return;
        }
        this.baseline = result.project;
        this.recoveryRevision = result.project.revision;
        this.attempt = undefined;
        // Only update metadata: edits made during the request must survive its acknowledgement.
        this.emit({
          project: {
            ...this.state.project,
            revision: result.project.revision,
            updatedAt: result.project.updatedAt,
          },
          phase: this.dirty ? "pending" : "saved",
        });
        this.persist();
      } catch (error) {
        this.emit({
          phase: "error",
          message: projectError(
            error,
            "Could not save. Your edits are still open. Retry when connected.",
          ),
        });
        return;
      }
    }
    if (!this.disposed && this.state.phase !== "missing")
      this.emit({ phase: "saved" });
  }
  useSavedVersion = () => {
    if (!this.latestRemote) return;
    clearTimeout(this.timer);
    this.attempt = undefined;
    this.baseline = this.latestRemote;
    this.recoveryRevision = this.baseline.revision;
    this.emit({
      project: this.baseline,
      epoch: this.state.epoch + 1,
      phase: "saved",
      message: "Loaded the saved version. Simulation stopped.",
    });
    this.persist();
  };
  async settledJournal() {
    await this.journal;
  }
  discardRecovery() {
    // Only used after deletion or after the full draft was saved as a copy.
    this.baseline = this.state.project;
    this.attempt = undefined;
    this.persist();
  }
  dispose() {
    clearTimeout(this.timer);
    this.disposed = true;
    this.listeners.clear();
  }
}
