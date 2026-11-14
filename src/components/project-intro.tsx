import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { LESSONS, lessonSteps } from "../learning/lessons";
import { createProject } from "../projects/store";
import { SiteHeader } from "./home";
import { ProjectArt } from "./project-art";
import { useState } from "react";
import { Button } from "./ui/button";
export function ProjectIntro({ id }: { id: string }) {
  const lesson = LESSONS.find((l) => l.id === id);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  if (!lesson)
    return (
      <div className="site-page">
        <SiteHeader />
        <main className="site-content">
          <h1>Project not found</h1>
          <Link to="/learn">Choose a project</Link>
        </main>
      </div>
    );
  const index = LESSONS.indexOf(lesson);
  async function start(guided: boolean) {
    try {
      const p = createProject(lesson!.preset, guided);
      await navigate({ to: "/bench/$projectId", params: { projectId: p.id } });
    } catch {
      setError("Could not start this project. Try again.");
    }
  }
  return (
    <div className="site-page">
      <SiteHeader />
      <main className="site-content intro-content">
        <Link className="back-link" to="/learn">
          <ArrowLeft size={15} /> Explore projects
        </Link>
        <section className="project-intro">
          <div>
            <span className="eyebrow">
              ELECTRONICS, REFRESHED / PROJECT 0{index + 1}
            </span>
            <h1>{lesson.title}</h1>
            <p>{lesson.description}</p>
            <div className="intro-tags">
              <span>{lesson.duration}</span>
              <span>Arduino Uno</span>
              <span>Guided experiment</span>
            </div>
            <div className="hero-actions">
              <Button onClick={() => start(true)}>
                Start building <ArrowRight size={16} />
              </Button>
              <Button variant="outline" onClick={() => start(false)}>
                Open working example
              </Button>
            </div>
            {error && <p role="alert">{error}</p>}
          </div>
          <div className="intro-art">
            <ProjectArt kind={lesson.id} large />
          </div>
        </section>
        <section className="intro-details">
          <div>
            <span className="eyebrow">WHAT YOU'LL MAKE</span>
            <h2>
              {id === "counter"
                ? "A project that remembers"
                : id === "blink"
                  ? "A light with a rhythm"
                  : id === "button"
                    ? "A circuit that listens"
                    : "A message you can change"}
            </h2>
            <p>
              {id === "counter"
                ? "Connect two inputs and a display. Count once per press, reset the result, and inspect the signals alongside your code."
                : id === "blink"
                  ? "Complete an LED circuit on a breadboard. Make the light blink, then control its timing."
                  : id === "button"
                    ? "Make an LED respond to a physical button. Discover why a pressed button can read LOW."
                    : "Send a greeting and a changing value to an LCD. Follow power rails and the signals that carry your text."}
            </p>
            <h3>On your bench</h3>
            <p>
              Arduino Uno · Breadboard ·{" "}
              {id === "counter"
                ? "2 pushbuttons · 16×2 LCD display"
                : id === "lcd"
                  ? "16×2 LCD display"
                  : id === "button"
                    ? "Pushbutton · LED · Resistor"
                    : "LED · Resistor"}{" "}
              · Jumper wires
            </p>
          </div>
          <div>
            <span className="eyebrow">YOUR ROUTE THROUGH THE PROJECT</span>
            <ol className="project-outline">
              {lessonSteps(lesson).map((s, i) => (
                <li key={s.title}>
                  <span>0{i + 1}</span>
                  <div>
                    <strong>{s.title}</strong>
                    <small>
                      {s.check === "read"
                        ? "Understand and experiment"
                        : "Build and check on the bench"}
                    </small>
                  </div>
                  <Check size={14} />
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}
