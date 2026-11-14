import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  X,
  RotateCcw,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  LESSONS,
  checkStep,
  lessonSteps,
  lessonStepCode,
  observeButton,
  observeCounter,
  type Lesson,
  type Evidence,
} from "../learning/lessons";
import type { CircuitDoc } from "../circuit/model";
import type { Snapshot } from "../simulation/machine";
const KEY = "piko.learning.v1";
type Progress = Record<string, number[]>;
export default function LearningGuide({
  initialLessonId,
  persistProgress = true,
  open,
  onClose,
  onStart,
  onExample,
  onCode,
  onResetCode,
  onHighlight,
  doc,
  snapshot,
  running,
  sketch,
  compiledSource,
}: {
  initialLessonId?: string;
  persistProgress?: boolean;
  open: boolean;
  onClose: () => void;
  onStart: (lesson: Lesson) => void;
  onExample: (id: string) => void;
  onCode: () => void;
  onResetCode: (code: string) => void;
  onHighlight?: (terminal: string) => void;
  doc: CircuitDoc;
  snapshot: Snapshot;
  running: boolean;
  sketch: string;
  compiledSource: string | null;
}) {
  const [active, setActive] = useState<string | null>(initialLessonId || null);
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState<Progress>({});
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [counterEvidence, setCounterEvidence] = useState({
    counted: false,
    reset: false,
  });
  const [evidence, setEvidence] = useState<Evidence>({
    pressed: false,
    released: false,
  });
  useEffect(() => {
    if (!persistProgress) {
      setLoaded(true);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (
        saved?.version === 1 &&
        saved.progress &&
        typeof saved.progress === "object"
      ) {
        const clean: Progress = {};
        for (const lesson of LESSONS) {
          const values = saved.progress[lesson.id];
          if (Array.isArray(values))
            clean[lesson.id] = [
              ...new Set(
                values.filter(
                  (n: unknown): n is number =>
                    typeof n === "number" &&
                    Number.isInteger(n) &&
                    n >= 0 &&
                    n < lesson.checks.length,
                ),
              ),
            ];
        }
        setProgress(clean);
      }
    } catch {
      setStorageWarning(
        "Progress cannot be loaded on this device. You can still follow every lesson.",
      );
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded && persistProgress)
      try {
        localStorage.setItem(KEY, JSON.stringify({ version: 1, progress }));
      } catch {
        setStorageWarning("Progress cannot be saved on this device.");
      }
  }, [progress, loaded]);
  useEffect(() => {
    if (!active || !running) return;
    if (active === "counter")
      setCounterEvidence((old) => observeCounter(snapshot, old));
    setEvidence((old) => {
      const next = observeButton(snapshot, doc, old);
      return next.pressed === old.pressed && next.released === old.released
        ? old
        : next;
    });
  }, [snapshot, doc, active, running]);
  useEffect(() => {
    setCounterEvidence({ counted: false, reset: false });
  }, [compiledSource, active]);
  const lesson = LESSONS.find((l) => l.id === active);
  if (!open) return null;
  const steps = lesson ? lessonSteps(lesson) : [];
  const current = steps[step];
  const resetCode = lesson ? lessonStepCode(lesson, step) : null;
  const done = lesson ? progress[lesson.id] || [] : [];
  function start(item: Lesson) {
    onStart(item);
    setActive(item.id);
    setStep(0);
    setMessage("");
    setEvidence({ pressed: false, released: false });
  }
  function check() {
    if (!lesson || !current) return;
    const result = checkStep(
      current.check,
      doc,
      snapshot,
      { ...evidence, ...counterEvidence },
      {
        sketch,
        compiledSource,
      },
    );
    setMessage(
      current.check === "read" ? "Reflection recorded." : result.message,
    );
    setProgress((p) => ({
      ...p,
      [lesson.id]: result.passed
        ? [...new Set([...(p[lesson.id] || []), step])]
        : (p[lesson.id] || []).filter((i) => i !== step),
    }));
    return result.passed;
  }
  function readAndContinue() {
    if (check() && step < steps.length - 1) {
      setStep(step + 1);
      setMessage("");
    }
  }
  return (
    <aside
      className="learning-panel"
      aria-label="Learning guide"
      id="learning-sidebar"
    >
      <div className="panel-header">
        <span>
          <BookOpen size={16} /> Learn by building
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close learning guide"
          onClick={onClose}
        >
          <X size={15} />
        </Button>
      </div>
      <div className="learning-body">
        {storageWarning && (
          <p className="learning-notice" role="status">
            {storageWarning}
          </p>
        )}
        {!lesson && !persistProgress ? (
          <>
            <h2 className="lesson-heading">What would you like to make?</h2>
            <p className="learning-intro">
              Explore a guided project to build something step by step. Each
              project opens its own bench, so this one stays intact.
            </p>
            <Link to="/learn" className="primary-link">
              Explore projects <ChevronRight size={14} />
            </Link>
          </>
        ) : !lesson ? (
          <>
            <p className="learning-intro">
              Build something small. Understand each connection. Then make it
              yours.
            </p>
            {LESSONS.map((item, i) => (
              <article className="lesson-card" key={item.id}>
                <span className="lesson-meta">
                  0{i + 1} · {item.duration} · {progress[item.id]?.length || 0}/
                  {item.checks.length} steps
                </span>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <div className="lesson-card-actions">
                  <Button onClick={() => start(item)}>
                    Start {item.id === "lcd" ? "LCD" : item.id} lesson{" "}
                    <ChevronRight size={14} />
                  </Button>
                  {!!progress[item.id]?.length && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setActive(item.id);
                        setStep(0);
                        setMessage("");
                      }}
                    >
                      Read guide
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </>
        ) : (
          <>
            {!persistProgress ? (
              <Link to="/learn" className="lesson-back">
                <ChevronLeft size={13} /> Explore projects
              </Link>
            ) : (
              <button
                className="lesson-back"
                onClick={() => {
                  setActive(null);
                  setMessage("");
                }}
              >
                <ChevronLeft size={13} /> All projects
              </button>
            )}
            <h2 className="lesson-heading">{lesson.title}</h2>
            <div
              className="lesson-progress"
              aria-label={`${done.length} of ${steps.length} steps completed`}
            >
              {steps.map((s, i) => (
                <button
                  key={s.title}
                  className={i === step ? "current" : ""}
                  aria-label={`Step ${i + 1}: ${s.title}`}
                  aria-current={i === step ? "step" : undefined}
                  onClick={() => {
                    setStep(i);
                    setMessage("");
                  }}
                >
                  {done.includes(i) ? <Check size={12} /> : i + 1}
                </button>
              ))}
            </div>
            <div className="lesson-meta">
              STEP {step + 1} OF {steps.length} ·{" "}
              {current.check === "read" ? "Read & reflect" : "Bench check"}
            </div>
            <h3 className="step-heading">{current.title}</h3>
            <div className="lesson-markdown">
              <Markdown skipHtml>{current.markdown}</Markdown>
            </div>
            {onHighlight && (
              <div
                className="guide-pin-finders"
                aria-label="Locate circuit pins"
              >
                {(lesson.id === "counter"
                  ? ["D8", "D9", "GND"]
                  : lesson.id === "lcd"
                    ? ["D12", "D11", "GND"]
                    : ["D13", "GND"]
                ).map((pin) => (
                  <button key={pin} onClick={() => onHighlight(`uno:${pin}`)}>
                    Find {pin}
                  </button>
                ))}
              </div>
            )}
            <div className="lesson-tools">
              <Button variant="outline" size="sm" onClick={onCode}>
                <Code2 size={14} /> Open code
              </Button>
              {resetCode !== null && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onResetCode(resetCode);
                    setProgress((p) => ({
                      ...p,
                      [lesson.id]: (p[lesson.id] || []).filter((i) => i < step),
                    }));
                    setMessage(
                      "This step’s starting code is restored. Your wiring is unchanged. Edit the code and run again.",
                    );
                  }}
                >
                  <RotateCcw size={14} /> Reset step code
                </Button>
              )}
              {persistProgress && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onExample(lesson.preset);
                    setEvidence({ pressed: false, released: false });
                    setMessage(
                      "Working example loaded. Use Undo preset to recover your build.",
                    );
                  }}
                >
                  Load working example
                </Button>
              )}
            </div>
            <div className="lesson-check">
              <Button
                variant={done.includes(step) ? "secondary" : "default"}
                onClick={
                  current.check === "read" && step < steps.length - 1
                    ? readAndContinue
                    : check
                }
              >
                {current.check === "read"
                  ? step < steps.length - 1
                    ? "Read & continue"
                    : "Mark as read"
                  : "Check my bench"}
                {done.includes(step) && <Check size={14} />}
              </Button>
              <p role="status">
                {message || (done.includes(step) ? "Completed." : "")}
              </p>
            </div>
            <div className="lesson-navigation">
              <Button
                variant="ghost"
                disabled={step === 0}
                onClick={() => {
                  setStep(step - 1);
                  setMessage("");
                }}
              >
                <ChevronLeft size={14} /> Back
              </Button>
              {step < steps.length - 1 && current.check !== "read" ? (
                <Button
                  variant="outline"
                  disabled={!done.includes(step)}
                  onClick={() => {
                    if (check()) {
                      setStep(step + 1);
                      setMessage("");
                    }
                  }}
                >
                  Next <ChevronRight size={14} />
                </Button>
              ) : step === steps.length - 1 ? (
                <Button
                  variant="outline"
                  disabled={done.length !== steps.length}
                  onClick={() => {
                    if (check()) {
                      setActive(null);
                      setMessage("");
                    }
                  }}
                >
                  Finish project
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
