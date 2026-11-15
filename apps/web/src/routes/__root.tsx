import {
  Link,
  HeadContent,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { ThemeProvider } from "../components/theme-toggle";
import type { ReactNode } from "react";
import "../styles.css";
import "../theme.css";
export const Route = createRootRoute({
  notFoundComponent: () => (
    <main className="session-empty">
      <h1>This page is not on the bench.</h1>
      <p>Choose a project and make something new.</p>
      <Link to="/">Return Home</Link>
    </main>
  ),
  head: () => ({
    links: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    meta: [
      { charSet: "utf-8" },
      { name: "theme-color", content: "#1b1e28" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Piko — a tiny electronics lab" },
      {
        name: "description",
        content:
          "Build intuition. Write real Arduino code. Watch your circuit come alive.",
      },
    ],
  }),
  shellComponent: ({ children }: { children: ReactNode }) => (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Scripts />
      </body>
    </html>
  ),
});
