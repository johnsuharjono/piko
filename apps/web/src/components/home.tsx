import { readProjectFile } from "../projects/file-io";
import { ThemeToggle } from "./theme-toggle";
import { Brand } from "./brand";
import { useState, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CircuitBoard, Plus, ArrowUpRight } from "lucide-react";
import { PRESETS } from "../circuit/presets";
import { LESSONS } from "../learning/lessons";
import { initialContent } from "../projects/store";
import { projectError } from "../projects/errors";
import { useProjects } from "../projects/provider";
import { projectContent } from "@piko/project-model";
import { AccountMenu } from "./account-menu";
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
      <div className="site-header-actions">
        <AccountMenu />
        <ThemeToggle />
      </div>
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
  const repository = useProjects();
  const projects = repository.projects || [];
  const [opening, setOpening] = useState(false);
  const [deleting, setDeleting] = useState<{
    id: string;
    revision: number;
  } | null>(null);
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  async function newBench(presetId = "empty") {
    if (opening) return;
    setOpening(true);
    try {
      const p = await repository.create(initialContent(presetId));
      await navigate({ to: "/bench/$projectId", params: { projectId: p.id } });
    } catch (error) {
      setError(
        projectError(error, "Could not open a bench. Please try again."),
      );
    } finally {
      setOpening(false);
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
              <Button
                disabled={opening || repository.status !== "ready"}
                variant="outline"
                onClick={() => newBench()}
              >
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
                  setOpening(true);
                  try {
                    const content = await readProjectFile(file);
                    const imported = await repository.create(content);
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
                    setOpening(false);
                  }
                }}
              />
              <button
                disabled={opening || repository.status !== "ready"}
                onClick={() => fileInput.current?.click()}
              >
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
        {(error || repository.error) && (
          <div className="project-alert" role="alert">
            <span>{error || repository.error}</span>
            {repository.status === "error" && (
              <Button size="sm" onClick={repository.retry}>
                Reconnect
              </Button>
            )}
          </div>
        )}
        {!catalog && projects.length > 0 && (
          <section className="recent-projects">
            <div className="section-heading">
              <div>
                <span className="eyebrow">YOUR WORKSPACE</span>
                <h2>Your projects</h2>
              </div>
            </div>
            <div className="recent-grid">
              {projects.map((p) => (
                <article className="saved-project" key={p.id}>
                  <Link
                    to="/bench/$projectId"
                    params={{ projectId: p.id }}
                    className="recent-card"
                  >
                    <CircuitBoard size={24} />
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.lessonId ? "Project + guide" : "Playground"}
                      </small>
                    </span>
                    <ArrowRight size={17} />
                  </Link>
                  <div className="project-card-actions">
                    {deleting?.id === p.id ? (
                      <>
                        <span>Delete this project?</span>
                        <Button
                          size="xs"
                          variant="destructive"
                          onClick={async () => {
                            try {
                              await repository.remove({
                                ...p,
                                revision: deleting!.revision,
                              });
                              setDeleting(null);
                            } catch (e) {
                              setError(
                                e instanceof Error
                                  ? e.message
                                  : "Could not delete project.",
                              );
                            }
                          }}
                        >
                          Delete
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setDeleting(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              const source = await repository.open(p.id);
                              if (!source) return;
                              const copy = await repository.create(
                                projectContent({
                                  ...source.getSnapshot().project,
                                  name: `${p.name.slice(0, 70)} (copy)`,
                                }),
                              );
                              await navigate({
                                to: "/bench/$projectId",
                                params: { projectId: copy.id },
                              });
                            } catch {
                              setError("Could not duplicate project.");
                            }
                          }}
                        >
                          Duplicate
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            setDeleting({ id: p.id, revision: p.revision })
                          }
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </article>
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
                  disabled={opening || repository.status !== "ready"}
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
          </section>
        )}
      </main>
    </div>
  );
}
