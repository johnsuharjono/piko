import { Link } from "@tanstack/react-router";
import { useState } from "react";
import Markdown from "react-markdown";
import { BookOpen, ChevronLeft, Code2, RotateCcw, X } from "lucide-react";
import { Button } from "./ui/button";
import { LESSONS, guideSections, type Lesson } from "../learning/lessons";
import { PRESETS } from "../circuit/presets";

export default function LearningGuide({
  initialLessonId, open, onClose, onStart, onCode, onResetCode,
}: {
  initialLessonId?: string;
  open: boolean;
  onClose: () => void;
  onStart: (lesson: Lesson) => void;
  onCode: () => void;
  onResetCode: (code: string) => void;
}) {
  const [active, setActive] = useState(initialLessonId || null);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const lesson = LESSONS.find((item) => item.id === active);
  if (!open) return null;
  const sections = lesson ? guideSections(lesson) : [];
  return (
    <aside className="learning-panel" aria-label="Project guide" id="learning-sidebar">
      <div className="panel-header">
        <span><BookOpen size={16} /> Project guide</span>
        <Button variant="ghost" size="icon-sm" aria-label="Close project guide" onClick={onClose}><X size={15} /></Button>
      </div>
      <div className="learning-body">
        {!lesson ? (
          <>
            <h2 className="lesson-heading">Pick a project</h2>
            <p className="learning-intro">Open a working circuit and explore how its code and wiring fit together.</p>
            {LESSONS.map((item) => (
              <article className="lesson-card" key={item.id}>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <Button onClick={() => {
                  onStart(item);
                  setActive(item.id);
                  setResetting(false);
                  setMessage("");
                }}>Open {item.id === "lcd" ? "LCD" : item.id} project</Button>
              </article>
            ))}
          </>
        ) : (
          <>
            <Link to="/learn" className="lesson-back"><ChevronLeft size={13} /> All projects</Link>
            <h2 className="lesson-heading">{lesson.title}</h2>
            <p className="learning-intro">{lesson.description}</p>
            <div className="lesson-tools">
              <Button variant="outline" size="sm" onClick={onCode}><Code2 size={14} /> Open code</Button>
              <Button variant="ghost" size="sm" onClick={() => { setResetting(!resetting); setMessage(""); }}><RotateCcw size={14} /> Restore example code</Button>
            </div>
            {resetting && (
              <div className="article-reset" role="group" aria-label="Restore example code">
                <p>Replace your code with this project’s original sketch? Your wiring stays as it is.</p>
                <Button size="sm" onClick={() => {
                  onResetCode(PRESETS.find((p) => p.id === lesson.preset)!.sketch);
                  setResetting(false);
                  setMessage("Example code restored. Run it when you’re ready.");
                }}>Replace code</Button>
                <Button variant="ghost" size="sm" onClick={() => setResetting(false)}>Cancel</Button>
              </div>
            )}
            {message && <p className="learning-notice" role="status">{message}</p>}
            <nav className="article-contents" aria-label="In this guide">
              {sections.map((section, i) => <a key={section.title} href={`#guide-${lesson.id}-${i}`}>{section.title}</a>)}
            </nav>
            <article className="lesson-markdown" aria-label={lesson.title}>
              {sections.map((section, i) => (
                <section key={section.title} id={`guide-${lesson.id}-${i}`} className="article-section">
                  <h3>{section.title}</h3>
                  <Markdown skipHtml>{section.markdown}</Markdown>
                </section>
              ))}
            </article>
          </>
        )}
      </div>
    </aside>
  );
}
