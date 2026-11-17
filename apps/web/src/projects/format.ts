import { COMPONENTS, type ComponentKind } from "../circuit/components";
import {
  parseCircuit,
  type CircuitDoc,
  type Part,
  type Wire,
} from "../circuit/model";
import type { Project } from "./store";
export type DiagramComponent = {
  id: string;
  type: ComponentKind;
  position: { x: number; y: number };
  properties: Record<string, unknown>;
};
export type Diagram = {
  version: 1;
  components: DiagramComponent[];
  connections: Wire[];
};
export type ProjectFile = {
  format: "piko-project";
  version: 1;
  name: string;
  board: "arduino:avr:uno";
  files: { "sketch.ino": string; "diagram.json": Diagram };
  libraries: { name: string; version: string }[];
  lessonId?: string;
};
export function toDiagram(doc: CircuitDoc): Diagram {
  return {
    version: 1,
    components: [
      { id: "uno", type: "uno", position: { ...doc.uno }, properties: {} },
      ...doc.breadboards.map((b) => ({
        id: b.id,
        type: "breadboard" as const,
        position: { x: b.x, y: b.y },
        properties: {},
      })),
      ...(doc.lcd
        ? [
            {
              id: "lcd",
              type: "lcd" as const,
              position: { ...doc.lcd },
              properties: {},
            },
          ]
        : []),
      ...doc.parts.map(({ id, kind, x, y, ...properties }) => ({
        id,
        type: kind,
        position: { x, y },
        properties,
      })),
    ],
    connections: structuredClone(doc.wires),
  };
}
export function fromDiagram(value: unknown): CircuitDoc {
  const d = value as Diagram;
  if (
    !d ||
    d.version !== 1 ||
    !Array.isArray(d.components) ||
    d.components.length > 15 ||
    !Array.isArray(d.connections) ||
    d.connections.length > 64
  )
    throw new Error("Invalid circuit diagram.");
  const doc: CircuitDoc = {
    version: 1,
    uno: { x: 0, y: 0 },
    breadboards: [],
    parts: [],
    wires: d.connections,
  };
  const ids = new Set<string>(),
    counts = new Map<string, number>();
  for (const c of d.components) {
    if (
      !c ||
      typeof c.id !== "string" ||
      !/^[A-Za-z][A-Za-z0-9]{0,15}$/.test(c.id) ||
      ids.has(c.id) ||
      !Object.hasOwn(COMPONENTS, c.type) ||
      !c.position ||
      !Number.isFinite(c.position.x) ||
      !Number.isFinite(c.position.y) ||
      !c.properties ||
      typeof c.properties !== "object"
    )
      throw new Error("Invalid or unsupported component.");
    ids.add(c.id);
    const n = (counts.get(c.type) || 0) + 1;
    counts.set(c.type, n);
    if (n > COMPONENTS[c.type].maxInstances)
      throw new Error(
        `Too many ${COMPONENTS[c.type].label} components for this model.`,
      );
    if (c.type === "uno") {
      if (c.id !== "uno") throw new Error("The Uno must use its reserved ID.");
      doc.uno = c.position;
    } else if (c.type === "breadboard") {
      if (["uno", "lcd"].includes(c.id))
        throw new Error("Reserved component ID.");
      doc.breadboards.push({ id: c.id, ...c.position });
    } else if (c.type === "lcd") {
      if (c.id !== "lcd") throw new Error("The LCD must use its reserved ID.");
      doc.lcd = c.position;
    } else {
      if (["uno", "lcd"].includes(c.id))
        throw new Error("Reserved component ID.");
      doc.parts.push({
        ...c.properties,
        ...c.position,
        id: c.id,
        kind: c.type,
      } as Part);
    }
  }
  if (counts.get("uno") !== 1)
    throw new Error("This project needs one Arduino Uno.");
  const parsed = parseCircuit(doc);
  if (!parsed) throw new Error("Invalid wiring or component properties.");
  return parsed;
}
export function encodeProject(
  project: Pick<Project, "name" | "sketch" | "circuit" | "lessonId">,
): string {
  const file: ProjectFile = {
    format: "piko-project",
    version: 1,
    name: project.name,
    board: "arduino:avr:uno",
    files: {
      "sketch.ino": project.sketch,
      "diagram.json": toDiagram(project.circuit),
    },
    libraries: project.sketch.includes("LiquidCrystal.h")
      ? [{ name: "LiquidCrystal", version: "1.0.7" }]
      : [],
    ...(project.lessonId ? { lessonId: project.lessonId } : {}),
  };
  return JSON.stringify(file, null, 2);
}
export function decodeProject(
  text: string,
): Pick<Project, "name" | "sketch" | "circuit" | "lessonId"> {
  if (text.length > 200000)
    throw new Error("Project files must be smaller than 200 KB.");
  let file: ProjectFile;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error("Choose a valid .piko.json project file.");
  }
  if (
    !file ||
    file.format !== "piko-project" ||
    file.version !== 1 ||
    file.board !== "arduino:avr:uno"
  )
    throw new Error("This project format or board is not supported.");
  if (
    typeof file.name !== "string" ||
    !file.name.trim() ||
    file.name.length > 80 ||
    typeof file.files?.["sketch.ino"] !== "string" ||
    file.files["sketch.ino"].length > 32000
  )
    throw new Error("Invalid project name or sketch.");
  if (
    !Array.isArray(file.libraries) ||
    file.libraries.some(
      (l) => !l || l.name !== "LiquidCrystal" || l.version !== "1.0.7",
    )
  )
    throw new Error("This project needs an unsupported library.");
  if (
    Object.keys(file.files).some(
      (name) => name !== "sketch.ino" && name !== "diagram.json",
    )
  )
    throw new Error(
      "This project includes unsupported files. Version 1 supports sketch.ino and diagram.json.",
    );
  const circuit = fromDiagram(file.files["diagram.json"]);
  return {
    name: file.name,
    sketch: file.files["sketch.ino"],
    circuit,
    ...(typeof file.lessonId === "string" ? { lessonId: file.lessonId } : {}),
  };
}
export function downloadProject(
  project: Pick<Project, "name" | "sketch" | "circuit" | "lessonId">,
) {
  const url = URL.createObjectURL(
    new Blob([encodeProject(project)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download =
    (project.name.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") ||
      "project") + ".piko.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
