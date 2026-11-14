import {
  lazy,
  type SetStateAction,
  type CSSProperties,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Activity,
  ArrowDownToLine,
  Download,
  BookOpen,
  Check,
  CircuitBoard,
  Code2,
  ExternalLink,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Square,
  Terminal,
  X,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Brand } from "./brand";
import { Link } from "@tanstack/react-router";
import { ToolResize } from "./tool-resize";
import { downloadProject, toDiagram } from "../projects/format";
import type { Project } from "../projects/store";
import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Circuit, type ComponentName } from "./circuit";
import { Trace } from "./trace";
import { Picker } from "./picker";
import { useCircuit } from "../circuit/use-circuit";
import { analyzeCircuit, ledIsOn, lcdConnections } from "../circuit/model";
import { PRESETS } from "../circuit/presets";
import type { CircuitDoc } from "../circuit/model";
import { STARTER } from "../lib/examples";
import { useBench } from "../simulation/use-bench";
import { lessonProject, type Lesson } from "../learning/lessons";
const LearningGuide = lazy(() => import("./learning-guide"));
const CodeEditor = lazy(() => import("./code-editor"));
const STORAGE_KEY = "piko.sketch.v1";
const explanations: Record<ComponentName, { title: string; text: string }> = {
  button: {
    title: "A contact you can hold closed",
    text: "The two-terminal momentary button connects its contacts only while held. Wire one contact to a GPIO input and the other to GND, then use INPUT_PULLUP. Released reads HIGH; pressed reads LOW. While running, hold the center of the button to operate it. Stop the simulation to drag its body freely. This is an ideal contact model without mechanical bounce.",
  },
  switch: {
    title: "An input that stays where you put it",
    text: "This is a two-terminal SPST slide switch. Toggle its center to open or close the contact. Wire it from a GPIO input to GND and use INPUT_PULLUP: open reads HIGH and closed reads LOW. Run first, then click its center. Its live position is a simulation control; it does not restart the sketch.",
  },
  breadboard: {
    title: "A grid of holes, a handful of hidden connections",
    text: "In each numbered column, a–e connect together and f–j connect together. The center gap separates those two groups. Every power rail splits between columns 15 and 16: add a jumper to bridge it. The + and − markings are labels, not power sources; wire rails to the Uno’s 5V or GND. Hover a hole to highlight its connected net, or turn on Show breadboard strips. Crossing wires do not connect unless their endpoints share a net.",
  },
  board: {
    title: "A small computer, a physical output",
    text: "The Uno runs setup() once, then repeats loop(). pinMode(13, OUTPUT) lets its D13 pin drive a digital signal. HIGH and LOW describe the pin’s logic state. The small onboard L LED shares D13; LED1 is the separate external LED.",
  },
  resistor: {
    title: "Give the LED a little resistance",
    text: "R1 limits current through the LED. In real hardware, choose it using the supply voltage, LED forward voltage, and desired current. The starter uses 330 Ω; this bench supports values from 220 Ω to 1 kΩ. Piko models digital states; it does not measure current or solve an analog circuit.",
  },
  led: {
    title: "Light has a direction",
    text: "An LED is a light-emitting diode. Its anode (+, usually the longer leg) faces the output through R1. Its cathode (−, the flat side and usually shorter leg) returns to GND. The LED lights only when its wiring forms a supported resistor-limited path from an active output (or 5V) to GND.",
  },
};

export function Bench({
  project,
  onProjectSave,
}: { project?: Project; onProjectSave?: (project: Project) => unknown } = {}) {
  const [sketch, setSketch] = useState(project?.sketch || STARTER);
  const [loaded, setLoaded] = useState(!!project);
  const [saved, setSaved] = useState(true);
  const [storageWarning, setStorageWarning] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [selected, setSelected] = useState(13);
  const [example, setExample] = useState("Blink");
  const [component, setComponent] = useState<ComponentName>("board");
  type Tool = "components" | "inspect" | "help";
  const [toolWidth, setToolWidth] = useState(440);
  const [tool, setTool] = useState<Tool | null>(project ? null : "components");
  const [codeOpen, setCodeOpen] = useState(
    () =>
      !!project &&
      (typeof window === "undefined" ||
        !window.matchMedia?.("(max-width: 700px)").matches),
  );
  const ignoreDiagramEdit = useCallback(() => {}, []);
  const [file, setFile] = useState<"sketch.ino" | "diagram.json">("sketch.ino");
  const detailsOpen = tool === "inspect",
    learnOpen = tool === "help";
  const setToolView = (kind: Tool, value: SetStateAction<boolean>) =>
    setTool((current) => {
      const next =
        typeof value === "function" ? value(current === kind) : value;
      return next ? kind : current === kind ? null : current;
    });
  const setDetailsOpen = (value: SetStateAction<boolean>) =>
    setToolView("inspect", value);
  const setLearnOpen = (value: SetStateAction<boolean>) =>
    setToolView("help", value);
  const selectedComponent = useCallback(() => setTool(null), []);
  const [trayTarget, setTrayTarget] = useState<HTMLDivElement | null>(null);
  const [lessonId, setLessonId] = useState(project?.lessonId);
  const [projectName, setProjectName] = useState(project?.name || "Your bench");
  const [guideOpen, setGuideOpen] = useState(!!project?.lessonId);
  const [controls, setControls] = useState<Record<string, boolean>>({});
  const [preset, setPreset] = useState("custom");
  const [presetRevision, setPresetRevision] = useState(0);
  const [presetUndo, setPresetUndo] = useState<{
    doc: CircuitDoc;
    sketch: string;
    example: string;
    preset: string;
  } | null>(null);
  const bench = useBench();
  const [circuitEdited, setCircuitEdited] = useState(false);
  const onCircuitEdit = useCallback(() => {
    bench.reset();
    setControls({});
    setPreset("custom");
    setCircuitEdited(true);
  }, [bench.reset]);
  const circuit = useCircuit(
    onCircuitEdit,
    project?.circuit,
    project ? null : undefined,
  );
  const analysis = useMemo(
    () => analyzeCircuit(circuit.doc, controls),
    [circuit.doc, controls],
  );
  const inputSignature = JSON.stringify(analysis.inputs);
  useEffect(() => {
    bench.setInputs(analysis.inputs);
  }, [inputSignature, bench.setInputs]);
  const inputConflicts = Object.keys(analysis.inputs)
    .filter((pin) => bench.snapshot.pins[Number(pin)]?.mode === "OUTPUT")
    .map(
      (pin) =>
        `D${pin} is connected as a contact input but configured OUTPUT. Use INPUT_PULLUP in the sketch.`,
    );
  useEffect(() => {
    if (
      (inputConflicts.length || analysis.errors.length) &&
      bench.status === "running"
    )
      bench.pause();
  }, [inputConflicts.length, analysis.errors.length, bench.status]);
  const setControl = (id: string, active: boolean) =>
    setControls((current) =>
      current[id] === active ? current : { ...current, [id]: active },
    );
  const { snapshot, status } = bench;
  const simulationActive = status === "running" || status === "paused";
  const editingLocked = simulationActive || status === "compiling";
  const stopSimulation = () => {
    bench.reset();
    setControls({});
  };
  const pin = snapshot.pins[selected];
  const runSketch = () => {
    if (analysis.errors.length) return;
    setCircuitEdited(false);
    void bench.run(sketch, lcdConnections(circuit.doc));
  };
  const dirty =
    bench.compiledSource !== null && bench.compiledSource !== sketch;
  useEffect(() => {
    if (project) {
      setLoaded(true);
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (
          data.version === 1 &&
          typeof data.sketch === "string" &&
          data.sketch.length <= 32000
        ) {
          setSketch(data.sketch);
          if (data.sketch !== STARTER) setExample("Your sketch");
        }
      }
    } catch {
      setStorageWarning(
        "Local storage is unavailable. Export your sketch to keep it.",
      );
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    if (project) {
      try {
        onProjectSave?.({
          ...project,
          name: projectName.trim() || "Untitled bench",
          lessonId,
          circuit: circuit.doc,
          sketch,
        });
        setSaved(true);
        setStorageWarning("");
      } catch {
        setSaved(false);
        setStorageWarning(
          "Could not keep this bench in the session. Export your sketch before leaving.",
        );
      }
      return;
    }
    setSaved(false);
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 1, sketch }),
        );
        setSaved(true);
      } catch {
        setStorageWarning(
          "Could not save locally. Export your sketch to keep it.",
        );
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [sketch, loaded, circuit.doc, projectName, lessonId]);
  const editSketch = useCallback((value: string) => {
    setSketch(value);
    setPreset("custom");
    setExample("Your sketch");
  }, []);
  const exportSketch = () => {
    const url = URL.createObjectURL(new Blob([sketch], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "piko-sketch.ino";
    link.click();
    URL.revokeObjectURL(url);
  };
  const inspect = (name: ComponentName) => {
    hideGuideOnNarrowScreen();
    setComponent(name);
    setDetailsOpen(false);
    setLearnOpen(true);
  };
  const statusText = {
    idle: "Ready to run",
    compiling: "Compiling",
    running: "Simulation running",
    paused: "Simulation paused",
    error: "Needs attention",
  }[status];

  const [consoleOpen, setConsoleOpen] = useState(false);
  const faults = [
    ...(circuit.doc.lcd && !lcdConnections(circuit.doc)
      ? [
          "LCD needs 5V, GND, RW tied to GND, and six distinct GPIO connections for RS, E, D4–D7.",
        ]
      : []),
    ...analysis.errors,
    ...inputConflicts,
    ...analysis.leds
      .filter((led) => led.status !== "ready")
      .map((led) => led.message),
  ];
  const hideGuideOnNarrowScreen = () => {
    if (window.matchMedia?.("(max-width: 700px)").matches) {
      setGuideOpen(false);
      setCodeOpen(false);
    }
  };
  const openInspect = () => {
    hideGuideOnNarrowScreen();
    setDetailsOpen(true);
    setLearnOpen(false);
  };
  const toggleInspect = () => {
    hideGuideOnNarrowScreen();
    setDetailsOpen((v) => !v);
    setLearnOpen(false);
  };
  const toggleHelp = () => {
    hideGuideOnNarrowScreen();
    setLearnOpen((v) => !v);
    setDetailsOpen(false);
  };
  const loadPreset = (id: string) => {
    const item = PRESETS.find((p) => p.id === id);
    if (!item) return;
    setPresetUndo({ doc: circuit.doc, sketch, example, preset });
    circuit.update(item.create());
    setPresetRevision((v) => v + 1);
    setSketch(item.sketch);
    setExample(item.id === "blink" ? "Blink" : "Your sketch");
    setPreset(id);
    setControls({});
  };
  const startLesson = (lesson: Lesson) => {
    setLessonId(lesson.id);
    setProjectName(lesson.title);
    const project = lessonProject(lesson);
    setPresetUndo({ doc: circuit.doc, sketch, example, preset });
    circuit.update(project.doc);
    setSketch(project.sketch);
    setExample(lesson.preset === "blink" ? "Blink" : "Your sketch");
    setPresetRevision((v) => v + 1);
    setPreset("custom");
    setControls({});
  };
  const undoPreset = () => {
    if (!presetUndo) return;
    circuit.update(presetUndo.doc);
    setPresetRevision((v) => v + 1);
    setSketch(presetUndo.sketch);
    setExample(presetUndo.example);
    setPreset(presetUndo.preset);
    setPresetUndo(null);
  };
  const runLabel =
    status === "compiling"
      ? "Compiling…"
      : simulationActive
        ? "Stop simulation"
        : "Start simulation";
  return (
    <div className="workbench">
      <header className="topbar">
        {project ? (
          <Link to="/" className="bench-home" aria-label="Back to Home">
            <Brand compact />
            <span>Home</span>
          </Link>
        ) : (
          <a href="/" className="brand" aria-label="Piko home">
            <Brand />
          </a>
        )}
        <span className="project-divider" />
        {project && (
          <input
            className="project-name"
            aria-label="Project name"
            maxLength={80}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onBlur={() => {
              if (!projectName.trim()) setProjectName("Untitled bench");
            }}
          />
        )}
        {!project && (
          <Picker
            label="Bench preset"
            value={preset}
            items={[
              ...PRESETS.map((p) => ({ value: p.id, label: p.label })),
              ...(preset === "custom"
                ? [
                    {
                      value: "custom",
                      label: project ? "Load an example…" : "Custom bench",
                    },
                  ]
                : []),
            ]}
            onChange={loadPreset}
            className="preset-picker"
          />
        )}
        <details className="project-menu">
          <summary aria-label="Project menu">Project</summary>
          <div className="project-menu-content">
            <Button variant="ghost" aria-label="Export project" onClick={(event) => {
              downloadProject({ name: projectName.trim() || "Untitled bench", circuit: circuit.doc, sketch, lessonId });
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}>
              <Download size={15} /> Export project
            </Button>
            <small>Code and circuit · .piko.json</small>
          </div>
        </details>
        <span className="save-status">
          <Check size={13} />
          {project
            ? saved
              ? "Kept in this session"
              : "Not saved"
            : saved
              ? "All changes saved"
              : "Saving…"}
        </span>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open help"
          title="Help"
          onClick={toggleHelp}
        >
          <BookOpen size={18} />
        </Button>
      </header>
      <div className="app-toolbar">
        <Button
          variant={guideOpen ? "secondary" : "ghost"}
          aria-pressed={guideOpen}
          aria-label="Project guide"
          aria-controls="learning-sidebar"
          onClick={() => {
            setGuideOpen(!guideOpen);
            if (window.matchMedia?.("(max-width: 700px)").matches)
              setTool(null);
          }}
        >
          <BookOpen size={15} /> Guide
        </Button>
        <div className="toolbar-spacer" />
        <Button
          variant={codeOpen ? "secondary" : "outline"}
          onClick={() => {
            hideGuideOnNarrowScreen();
            setCodeOpen(!codeOpen);
          }}
          aria-pressed={codeOpen}
        >
          <Code2 size={16} />
          Code{dirty && <span className="edited-dot" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={
            status === "paused" ? "Resume simulation" : "Pause simulation"
          }
          title={status === "paused" ? "Resume" : "Pause"}
          disabled={status !== "running" && status !== "paused"}
          onClick={status === "paused" ? bench.resume : bench.pause}
        >
          {status === "paused" ? <Play size={15} /> : <Pause size={15} />}
        </Button>
        <Button
          className="run-button"
          onClick={simulationActive ? stopSimulation : runSketch}
          disabled={
            !loaded ||
            !circuit.loaded ||
            status === "compiling" ||
            (!simulationActive && !!analysis.errors.length)
          }
        >
          {status === "compiling" ? (
            <LoaderCircle className="spin" size={15} />
          ) : simulationActive ? (
            <Square size={15} fill="currentColor" />
          ) : (
            <Play size={15} fill="currentColor" />
          )}
          <span>{runLabel}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Reset simulation"
          title="Reset simulation"
          onClick={stopSimulation}
        >
          <RotateCcw size={16} />
        </Button>
      </div>
      <main
        className={`bench-main simulator-workbench ${codeOpen ? "code-is-open" : ""}`}
        aria-label="Breadboard bench"
        style={{ "--tool-width": `${toolWidth}px` } as CSSProperties}
      >
        <Suspense
          fallback={
            guideOpen ? (
              <aside className="learning-panel">
                <p className="editor-loading">Loading guides…</p>
              </aside>
            ) : null
          }
        >
          <LearningGuide
            initialLessonId={lessonId}
            open={guideOpen}
            onClose={() => setGuideOpen(false)}
            onStart={startLesson}
            onResetCode={(code) => {
              stopSimulation();
              editSketch(code);
            }}
            onCode={() => {
              hideGuideOnNarrowScreen();
              setCodeOpen(true);
            }}
          />
        </Suspense>
        {codeOpen && (
          <aside className="code-panel" aria-label="Arduino code editor">
            <ToolResize
              width={toolWidth}
              onChange={setToolWidth}
              side="right"
            />
            <div className="panel-header">
              <span>
                <Code2 size={15} />
                sketch.ino
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close code"
                onClick={() => setCodeOpen(false)}
              >
                <X size={16} />
              </Button>
            </div>
            <div
              className="file-tabs"
              role="tablist"
              aria-label="Project files"
            >
              {(["sketch.ino", "diagram.json"] as const).map((name) => (
                <button
                  role="tab"
                  aria-selected={file === name}
                  key={name}
                  onClick={() => setFile(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="editor-container">
              {loaded ? (
                <Suspense
                  fallback={<p className="editor-loading">Loading editor…</p>}
                >
                  <CodeEditor
                    value={
                      file === "sketch.ino"
                        ? sketch
                        : JSON.stringify(toDiagram(circuit.doc), null, 2)
                    }
                    onChange={
                      file === "sketch.ino" ? editSketch : ignoreDiagramEdit
                    }
                    readOnly={file === "diagram.json"}
                    language={file === "diagram.json" ? "json" : "cpp"}
                  />
                </Suspense>
              ) : null}
            </div>
            <div className="editor-footer">
              <span>
                {file === "diagram.json"
                  ? "Circuit document · read only"
                  : dirty
                    ? "Edited · stop and run to apply"
                    : saved
                      ? project
                        ? "Kept in this session"
                        : "Saved locally"
                      : "Saving…"}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Export sketch"
                aria-label="Export sketch"
                onClick={exportSketch}
              >
                <ArrowDownToLine size={14} />
              </Button>
            </div>
          </aside>
        )}
        <section className="circuit-panel" aria-label="Circuit workspace">
          <div className="canvas-actions">
            {" "}
            <Button
              variant={tool === "components" ? "secondary" : "outline"}
              aria-label="Components"
              aria-pressed={tool === "components"}
              onClick={() => {
                hideGuideOnNarrowScreen();
                setToolView("components", (v) => !v);
              }}
            >
              <CircuitBoard size={15} />
              <span>Components</span>
            </Button>
            <Button
              variant={detailsOpen ? "secondary" : "ghost"}
              aria-pressed={detailsOpen}
              aria-label="Inspect"
              aria-controls="circuit-inspector"
              onClick={toggleInspect}
            >
              <Activity size={15} />
              <span>Inspect</span>
              {faults.length > 0 && (
                <span className="issue-count">{faults.length}</span>
              )}
            </Button>
          </div>
          <Circuit
            key={presetRevision}
            doc={circuit.doc}
            onChange={circuit.update}
            onSelectionChange={selectedComponent}
            highlight={highlight}
            propertiesHidden={tool !== null}
            externalTray
            trayTarget={trayTarget}
            onToggleTray={() => setToolView("components", (v) => !v)}
            pins={snapshot.pins}
            lcdLines={snapshot.lcd}
            selected={selected}
            onPin={setSelected}
            onComponent={inspect}
            analysis={analysis}
            onUndo={circuit.undo}
            onRedo={circuit.redo}
            onRestore={() => loadPreset("blink")}
            canUndo={circuit.canUndo}
            canRedo={circuit.canRedo}
            interactive={simulationActive}
            editingLocked={editingLocked}
            controls={controls}
            onControlChange={setControl}
          />
        </section>
        {tool === "components" && (
          <aside className="bench-tools" aria-label="Components panel">
            <ToolResize width={toolWidth} onChange={setToolWidth} />
            <div className="panel-header">
              <span>Components</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close components"
                onClick={() => setTool(null)}
              >
                <X size={15} />
              </Button>
            </div>
            <div className="tray-host" ref={setTrayTarget} />
          </aside>
        )}
        {detailsOpen && (
          <aside
            className="utility-panel detail-panel"
            aria-label="Circuit inspector"
            id="circuit-inspector"
          >
            <ToolResize width={toolWidth} onChange={setToolWidth} />
            <div className="panel-header">
              <span>Circuit inspector</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close inspector"
                onClick={() => setDetailsOpen(false)}
              >
                <X size={15} />
              </Button>
            </div>
            <div className="sheet-body">
              <section className="pin-inspector">
                <div className="section-label">PIN</div>
                <Picker
                  label="Inspect pin"
                  value={String(selected)}
                  onChange={(v) => setSelected(Number(v))}
                  items={snapshot.pins.map((p) => ({
                    value: String(p.number),
                    label: p.number < 14 ? `D${p.number}` : `A${p.number - 14}`,
                  }))}
                />
                <div className="pin-value">
                  <strong>
                    {selected < 14 ? `D${selected}` : `A${selected - 14}`}
                  </strong>
                  <span className={`logic-pill ${pin.high ? "high" : ""}`}>
                    {pin.high ? "HIGH" : "LOW"}
                  </span>
                </div>
                <div className="pin-detail">
                  <span>Mode</span>
                  <strong>{pin.mode}</strong>
                </div>
                <div className="pin-detail">
                  <span>LED branches</span>
                  <strong>
                    {analysis.leds
                      .filter((l) => l.source === selected)
                      .map((l) => l.id)
                      .join(", ") || "None"}
                  </strong>
                </div>
              </section>
              <section className="trace-panel">
                <div className="section-label">
                  DIGITAL TRACE ·{" "}
                  {selected < 14 ? `D${selected}` : `A${selected - 14}`}
                </div>
                <Trace
                  time={snapshot.time}
                  transitions={snapshot.traces?.[selected] || []}
                  pin={selected}
                />
              </section>
              <section className="circuit-feedback">
                <div className="section-label">WIRING</div>
                {[...analysis.errors, ...inputConflicts].map((error) => (
                  <p className="branch-warning" key={error}>
                    {error}
                  </p>
                ))}
                {circuit.doc.lcd && (
                  <p
                    className={
                      lcdConnections(circuit.doc)
                        ? "branch-ready"
                        : "branch-warning"
                    }
                  >
                    {lcdConnections(circuit.doc)
                      ? "LCD connected."
                      : "LCD needs 5V, GND, RW tied to GND, and six distinct GPIO connections for RS, E and D4–D7."}
                  </p>
                )}
                {!analysis.leds.length && !circuit.doc.lcd && (
                  <p>No LEDs on the bench.</p>
                )}
                {analysis.leds.map((led) => (
                  <p
                    key={led.id}
                    className={
                      led.status === "ready" ? "branch-ready" : "branch-warning"
                    }
                  >
                    <span className="branch-state">
                      {led.status === "ready"
                        ? ledIsOn(led, snapshot.pins, !!analysis.errors.length)
                          ? "ON"
                          : "OFF"
                        : "CHECK"}
                    </span>
                    {led.message}
                  </p>
                ))}
              </section>
            </div>
          </aside>
        )}
        {learnOpen && (
          <aside className="utility-panel help-panel" aria-label="Bench help">
            <ToolResize width={toolWidth} onChange={setToolWidth} />
            <div className="panel-header">
              <span>Bench help</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close help"
                onClick={() => setLearnOpen(false)}
              >
                <X size={15} />
              </Button>
            </div>
            <div className="sheet-body">
              <Picker
                label="Learn about component"
                value={component}
                onChange={(value) => setComponent(value as ComponentName)}
                items={[
                  { value: "board", label: "Arduino Uno" },
                  { value: "breadboard", label: "Breadboard" },
                  { value: "resistor", label: "Resistor" },
                  { value: "led", label: "LED polarity" },
                  { value: "button", label: "Pushbutton" },
                  { value: "switch", label: "Slide switch" },
                ]}
              />
              <h2>{explanations[component].title}</h2>
              <p>{explanations[component].text}</p>
              <div className="help-steps">
                <h3>Working on the canvas</h3>
                <p>
                  Drag a component from the tray. Drag its body to move it;
                  green rings show leads plugged into holes.
                </p>
                <p>
                  Click two terminals to add a wire. Select a wire to reconnect
                  or delete it. Escape cancels a connection.
                </p>
                <p>
                  Drag empty space to pan. Use + / − to zoom, or Fit to see the
                  whole bench.
                </p>
              </div>
              <div className="model-note">
                This digital model supports resistor-limited LED branches and
                ideal GPIO-to-ground contacts with INPUT_PULLUP. It does not
                calculate analog current, brightness, or mechanical bounce.
              </div>
              <a
                className="reference-link"
                href="https://docs.arduino.cc/language-reference/"
                target="_blank"
                rel="noreferrer"
              >
                Arduino reference <ExternalLink size={14} />
              </a>
            </div>
          </aside>
        )}{" "}
      </main>
      {(analysis.errors.length > 0 || status === "error") && (
        <div className="error-banner" role="alert">
          <span>{analysis.errors[0] || bench.message.split("\n")[0]}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (analysis.errors.length) openInspect();
              else setConsoleOpen(true);
            }}
          >
            View details
          </Button>
        </div>
      )}
      {consoleOpen && (
        <section className="console-panel" aria-label="Execution console">
          <Button
            className="console-close"
            variant="ghost"
            size="icon-sm"
            aria-label="Close console"
            onClick={() => setConsoleOpen(false)}
          >
            <X size={15} />
          </Button>
          <Tabs defaultValue="messages">
            <TabsList variant="line">
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="serial">Serial monitor</TabsTrigger>
            </TabsList>
            <TabsContent value="messages">
              <pre className={status === "error" ? "message-error" : ""}>
                {bench.message}
              </pre>
              {storageWarning && <p>{storageWarning}</p>}
              {circuit.warning && <p>{circuit.warning}</p>}
            </TabsContent>
            <TabsContent value="serial">
              <pre>{snapshot.serial || "No serial output yet."}</pre>
            </TabsContent>
          </Tabs>
        </section>
      )}
      <footer className="statusbar">
        <span className={`status-dot ${status}`} />
        <span>
          {status === "idle"
            ? circuitEdited
              ? "Circuit changed · ready to run"
              : "Ready"
            : statusText}
        </span>
        <span className="simulation-time">
          {(snapshot.time / 1000).toFixed(2)} s
        </span>
        <div className="toolbar-spacer" />
        {presetUndo && <button onClick={undoPreset}>Undo preset</button>}
        <button onClick={openInspect}>
          {faults.length
            ? `${faults.length} circuit ${faults.length === 1 ? "issue" : "issues"}`
            : analysis.leds.length
              ? "Circuit connected"
              : circuit.doc.lcd
                ? "LCD connected"
                : "Empty bench"}
        </button>
        <button
          onClick={() => setConsoleOpen(!consoleOpen)}
          aria-expanded={consoleOpen}
        >
          <Terminal size={13} />
          Console
        </button>
        <button className="model-link" onClick={toggleHelp}>
          Digital model
        </button>
      </footer>
    </div>
  );
}
