import { readProjectFile } from "../projects/file-io";
import { ThemeToggle } from "./theme-toggle";
import { Brand } from "./brand";
import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CircuitBoard, Plus, ArrowUpRight } from "lucide-react";
import { PRESETS } from "../circuit/presets";
import { LESSONS } from "../learning/lessons";
import { createProject, listProjects, type Project } from "../projects/store";
import { ProjectArt } from "./project-art";
import { Button } from "./ui/button";
export function SiteHeader() {
  return (
    <header className="site-header">
      <Link to="/" className="brand">
        <Brand />
      </Link>
      <nav aria-label="Main navigation">
        <Link
          to="/"
          activeProps={{ "aria-current": "page" }}
          activeOptions={{ exact: true }}
        >
          Home
        </Link>
        <Link to="/learn" activeProps={{ "aria-current": "page" }}>
          Explore projects
        </Link>
      </nav>
      <ThemeToggle />
    </header>
  );
}
export function ProjectCards() {
  return (
    <div className="project-cards">
      {LESSONS.map((l, i) => (
        <Link
          to="/learn/$lessonId"
          params={{ lessonId: l.id }}
          key={l.id}
          className="project-card"
        >
          <ProjectArt kind={l.id} />
          <div className="project-card-body">
            <span className="eyebrow">
              0{i + 1} / {l.duration}
            </span>
            <h3>
              {l.title}
              <ArrowUpRight size={19} />
            </h3>
            <p>{l.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
export function Home({ catalog = false }: { catalog?: boolean }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setProjects(listProjects());
  }, []);
  async function newBench(presetId = "empty") {
    try {
      const p = createProject(presetId);
      await navigate({ to: "/bench/$projectId", params: { projectId: p.id } });
    } catch {
      setError("Could not open a bench. Please try again.");
    }
  }
  return (
    <div className="site-page">
      <SiteHeader />
      <main className="site-content">
        <section className={`home-hero ${catalog ? "catalog-hero" : ""}`}>
          <div>
            <h1>
              {catalog ? (
                <>
                  Small projects.
                  <br />
                  Real understanding.
                </>
              ) : (
                <>
                  Build a circuit.
                  <br />
                  <em>Make it work.</em>
                </>
              )}
            </h1>
            <p>
              {catalog
                ? "Working circuits, explained. Open a project, read its guide, and make it your own."
                : "Write Arduino code, connect parts, and run it in your browser."}
            </p>
            <div className="hero-actions">
              <Link
                to="/learn/$lessonId"
                params={{ lessonId: "blink" }}
                className="primary-link"
              >
                Make an LED blink <ArrowRight size={16} />
              </Link>
              <Button variant="outline" onClick={() => newBench()}>
                <Plus size={16} /> Open an empty bench
              </Button>
            </div>
            <div className="project-import">
              <input
                ref={fileInput}
                type="file"
                accept=".json,.piko.json,application/json"
                hidden
                aria-label="Open project file"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const imported = await readProjectFile(file);
                    await navigate({
                      to: "/bench/$projectId",
                      params: { projectId: imported.id },
                    });
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Could not open project.",
                    );
                  } finally {
                    e.target.value = "";
                  }
                }}
              />
              <button onClick={() => fileInput.current?.click()}>
                Open a .piko.json project
              </button>
            </div>
          </div>
          {!catalog && (
            <div className="hero-illustration">
              <ProjectArt kind="counter" large />
            </div>
          )}
        </section>
        {error && <p role="alert">{error}</p>}
        {!catalog && projects.length > 0 && (
          <section className="recent-projects">
            <div className="section-heading">
              <div>
                <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
                <h2>Your open benches</h2>
              </div>
              <span>Kept for this session</span>
            </div>
            <div className="recent-grid">
              {projects.map((p) => (
                <Link
                  to="/bench/$projectId"
                  params={{ projectId: p.id }}
                  key={p.id}
                  className="recent-card"
                >
                  <CircuitBoard size={24} />
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.lessonId ? "Project + guide" : "Playground"} · Open
                      workspace
                    </small>
                  </span>
                  <ArrowRight size={17} />
                </Link>
              ))}
            </div>
          </section>
        )}
        <section id="projects">
          <div className="section-heading">
            <div>
              <span className="eyebrow">BUILD SOMETHING. LEARN SOMETHING.</span>
              <h2>
                {catalog ? "Electronics, refreshed" : "Start with a small win"}
              </h2>
            </div>
            {!catalog && (
              <Link to="/learn">
                All projects <ArrowRight size={14} />
              </Link>
            )}
          </div>
          <ProjectCards />
        </section>
        {catalog && (
          <section className="more-experiments">
            <div className="section-heading">
              <div>
                <span className="eyebrow">READY TO EXPERIMENT</span>
                <h2>More working examples</h2>
              </div>
            </div>
            <div className="recent-grid">
              {PRESETS.filter((p) =>
                ["traffic", "alternating", "switch"].includes(p.id),
              ).map((p) => (
                <button
                  className="recent-card example-card"
                  key={p.id}
                  aria-label={`Open ${p.label} example`}
                  onClick={() => newBench(p.id)}
                >
                  <CircuitBoard size={24} />
                  <span>
                    <strong>{p.label}</strong>
                    <small>{p.description}</small>
                  </span>
                  <ArrowRight size={17} />
                </button>
              ))}
            </div>
            <p className="hero-note">
              Each example opens a fresh bench with matching code and wiring.
              Your open benches stay intact.
            </p>
          </section>
        )}
        <footer className="site-footer">
          <span>Benches last for this session. Export a project to keep it.</span>
        </footer>
      </main>
    </div>
  );
}
