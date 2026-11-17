import { afterEach, expect, it, vi } from "vitest";
import { ProjectDraft, type Save } from "../apps/web/src/projects/draft";
import type {
  Recovery,
  RecoveryStore,
} from "../apps/web/src/projects/recovery";
import { createProject } from "../apps/web/src/projects/store";
import { projectContent, type Project } from "@piko/project-model";
function fixture() {
  let remote = { ...createProject("blink"), revision: 1 };
  const records = new Map<string, Recovery>();
  const key = (owner: string, id: string) => `${owner}:${id}`;
  const recovery: RecoveryStore = {
    read: async (owner, id) =>
      structuredClone(records.get(key(owner, id)) || null),
    write: async (r) => {
      records.set(key(r.ownerId, r.id), structuredClone(r));
    },
    remove: async (owner, id) => {
      records.delete(key(owner, id));
    },
  };
  const save = vi.fn<Save>(async (args) => {
    if (args.expectedRevision !== remote.revision)
      return { status: "conflict", project: remote };
    remote = { ...remote, ...args.content, revision: remote.revision + 1 };
    return { status: "saved", project: remote };
  });
  const draft = new ProjectDraft(remote, "owner", save, recovery);
  const edit = (name: string) =>
    draft.update({ ...draft.getSnapshot().project, name });
  return {
    draft,
    edit,
    recovery,
    records,
    save,
    remote: () => remote,
    setRemote: (p: Project) => {
      remote = p;
    },
  };
}
afterEach(() => vi.useRealTimers());
it("debounces edits and only reports Saved after the server acknowledges them", async () => {
  vi.useFakeTimers();
  const f = fixture();
  f.edit("First");
  f.edit("Second");
  expect(f.draft.getSnapshot().phase).toBe("pending");
  expect(f.save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(650);
  expect(f.save).toHaveBeenCalledOnce();
  expect(f.remote().name).toBe("Second");
  expect(f.draft.getSnapshot().phase).toBe("saved");
  await f.draft.settledJournal();
  expect(f.records.size).toBe(0);
  f.draft.dispose();
});
it("preserves edits typed during an in-flight save and sends the next revision", async () => {
  const f = fixture();
  let release!: (value: Awaited<ReturnType<Save>>) => void;
  f.save.mockImplementationOnce(
    (args) =>
      new Promise((resolve) => {
        release = () => {
          const p = { ...f.remote(), ...args.content, revision: 2 };
          f.setRemote(p);
          resolve({ status: "saved", project: p });
        };
      }),
  );
  f.edit("A");
  const pending = f.draft.flush();
  f.edit("B");
  release({ status: "missing" });
  await pending;
  expect(f.remote().name).toBe("B");
  expect(f.save).toHaveBeenCalledTimes(2);
  expect(f.save.mock.calls[1][0].expectedRevision).toBe(2);
  expect(f.draft.getSnapshot().phase).toBe("saved");
  f.draft.dispose();
});
it("retries the same mutation id after an ambiguous network failure", async () => {
  const f = fixture();
  f.save.mockRejectedValueOnce(new Error("offline"));
  f.edit("Keep me");
  await f.draft.flush();
  expect(f.draft.getSnapshot().phase).toBe("error");
  const attempt = f.save.mock.calls[0][0];
  await f.draft.flush();
  expect(f.save.mock.calls[1][0]).toEqual(attempt);
  expect(f.draft.getSnapshot().phase).toBe("saved");
  f.draft.dispose();
});
it("does not overwrite another tab and requires explicit conflict resolution", async () => {
  const f = fixture();
  f.edit("My edits");
  const other = { ...f.remote(), name: "Other tab", revision: 2 };
  f.setRemote(other);
  await f.draft.flush();
  expect(f.draft.getSnapshot().phase).toBe("conflict");
  expect(f.draft.getSnapshot().project.name).toBe("My edits");
  await f.draft.flush();
  expect(f.save).toHaveBeenCalledOnce();
  f.draft.useSavedVersion();
  expect(f.draft.getSnapshot().project.name).toBe("Other tab");
  expect(f.draft.getSnapshot().epoch).toBe(1);
  f.draft.dispose();
});
it("recovers unacknowledged work after a full reload without confusing it with saved data", async () => {
  const f = fixture();
  f.edit("Recovered edit");
  await f.draft.settledJournal();
  f.draft.dispose();
  const reopened = new ProjectDraft(f.remote(), "owner", f.save, f.recovery);
  await reopened.recover();
  expect(reopened.getSnapshot().project.name).toBe("Recovered edit");
  expect(reopened.getSnapshot().phase).toBe("pending");
  await reopened.flush();
  expect(f.remote().name).toBe("Recovered edit");
  reopened.dispose();
});
it("keeps recovery conflicts across another reload and never reads another owner's draft", async () => {
  const f = fixture();
  f.edit("My old edit");
  await f.draft.settledJournal();
  f.draft.dispose();
  const remote = { ...f.remote(), name: "New saved version", revision: 2 };
  const reopened = new ProjectDraft(remote, "owner", f.save, f.recovery);
  await reopened.recover();
  expect(reopened.getSnapshot().phase).toBe("conflict");
  reopened.update({
    ...reopened.getSnapshot().project,
    name: "More local edits",
  });
  await reopened.settledJournal();
  reopened.dispose();
  const again = new ProjectDraft(remote, "owner", f.save, f.recovery);
  await again.recover();
  expect(again.getSnapshot().phase).toBe("conflict");
  const different = new ProjectDraft(
    remote,
    "someone-else",
    f.save,
    f.recovery,
  );
  await different.recover();
  expect(different.getSnapshot().project.name).toBe("New saved version");
  again.dispose();
  different.dispose();
});
it("applies remote updates only to clean drafts and signals a fresh stopped bench", () => {
  const f = fixture();
  f.draft.observe({ ...f.remote(), name: "Remote", revision: 2 });
  expect(f.draft.getSnapshot().project.name).toBe("Remote");
  expect(f.draft.getSnapshot().epoch).toBe(1);
  f.draft.dispose();
});
it("retains an open draft when its project is deleted", async () => {
  const f = fixture();
  f.edit("Still exportable");
  f.draft.observe(null);
  await f.draft.flush();
  expect(f.save).not.toHaveBeenCalled();
  expect(f.draft.getSnapshot().phase).toBe("missing");
  expect(projectContent(f.draft.getSnapshot().project).name).toBe(
    "Still exportable",
  );
  f.draft.dispose();
});
it("can save to the server even when browser recovery storage is unavailable", async () => {
  const f = fixture();
  f.recovery.read = async () => {
    throw new Error("storage blocked");
  };
  await f.draft.recover();
  expect(f.draft.getSnapshot().recoveryAvailable).toBe(false);
  f.edit("Cloud still works");
  await f.draft.flush();
  expect(f.remote().name).toBe("Cloud still works");
  expect(f.draft.getSnapshot().phase).toBe("saved");
  f.draft.dispose();
});
it("clears recovery after an explicitly saved copy or confirmed deletion", async () => {
  const f = fixture();
  f.edit("Copied safely elsewhere");
  await f.draft.settledJournal();
  expect(f.records.size).toBe(1);
  f.draft.discardRecovery();
  f.draft.dispose();
  await f.draft.settledJournal();
  expect(f.records.size).toBe(0);
  expect(f.draft.dirty).toBe(false);
});
