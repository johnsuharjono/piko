// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useProjectDocument } from "../apps/web/src/projects/use-document";
import { createProject } from "../apps/web/src/projects/store";
import type { Project } from "@piko/project-model";
let document: ReturnType<typeof useProjectDocument>;
function Harness({
  project,
  onChange,
}: {
  project: Project;
  onChange: (p: Project) => void;
}) {
  document = useProjectDocument(project, onChange);
  return null;
}
afterEach(() => vi.unstubAllGlobals());
it("commits edits immediately, composes batched changes, and does not replace an intentionally empty sketch", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = window.document.createElement("div"),
    root = createRoot(host),
    onChange = vi.fn(),
    p = { ...createProject("blink"), sketch: "" };
  try {
    await act(async () =>
      root.render(<Harness project={p} onChange={onChange} />),
    );
    expect(document.document.sketch).toBe("");
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => {
      document.updateDocument({ sketch: "edited" });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ sketch: "edited" }),
      );
      document.updateDocument({ name: "Renamed" });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: "Renamed", sketch: "edited" }),
      );
    });
    await act(async () =>
      root.render(
        <Harness project={{ ...p, revision: 2 }} onChange={onChange} />,
      ),
    );
    expect(document.document.sketch).toBe("edited");
  } finally {
    await act(async () => root.unmount());
  }
});
