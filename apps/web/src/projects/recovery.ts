import { validateContent, type ProjectContent } from "@piko/project-model";
export type Recovery = {
  ownerId: string;
  id: string;
  baseRevision: number;
  content: ProjectContent;
};
export interface RecoveryStore {
  read(owner: string, id: string): Promise<Recovery | null>;
  write(record: Recovery): Promise<void>;
  remove(owner: string, id: string): Promise<void>;
}
// This is an unsent-edit journal, never the source of saved projects. It is
// scoped by account and project and cleared after server acknowledgement.
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Recovery storage unavailable."));
      return;
    }
    const request = indexedDB.open("piko-recovery", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function operation<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", mode),
      request = run(tx.objectStore("drafts"));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export const recoveryStore: RecoveryStore = {
  async read(ownerId, id) {
    const value: unknown = await operation("readonly", (s) =>
      s.get(`${ownerId}:${id}`),
    );
    if (!value || typeof value !== "object") return null;
    const r = value as Recovery;
    if (
      r.ownerId !== ownerId ||
      r.id !== id ||
      !Number.isSafeInteger(r.baseRevision)
    )
      return null;
    try {
      return { ...r, content: validateContent(r.content) };
    } catch {
      return null;
    }
  },
  async write(record) {
    await operation("readwrite", (s) =>
      s.put(record, `${record.ownerId}:${record.id}`),
    );
  },
  async remove(owner, id) {
    await operation("readwrite", (s) => s.delete(`${owner}:${id}`));
  },
};
