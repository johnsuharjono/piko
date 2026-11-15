import counter from "./content/counter.md?raw";
import blink from "./content/blink.md?raw";
import button from "./content/button.md?raw";
import lcd from "./content/lcd.md?raw";
import { PRESETS } from "../circuit/presets";
export type Lesson = {
  id: string;
  title: string;
  description: string;
  duration: string;
  preset: string;
  markdown: string;
};
export const LESSONS: Lesson[] = [
  {
    id: "counter",
    title: "Build a button counter",
    description: "Combine code, buttons and a display into a complete project.",
    duration: "20 min",
    preset: "counter",
    markdown: counter,
  },
  {
    id: "blink",
    title: "Your first blinking LED",
    description: "Breadboard strips, polarity and timing.",
    duration: "10 min",
    preset: "blink",
    markdown: blink,
  },
  {
    id: "button",
    title: "Let a button decide",
    description: "Inputs, pull-ups and program decisions.",
    duration: "10 min",
    preset: "button",
    markdown: button,
  },
  {
    id: "lcd",
    title: "Say it on a screen",
    description: "Power rails, signals and your first text display.",
    duration: "15 min",
    preset: "lcd",
    markdown: lcd,
  },
];
export function guideSections(lesson: Lesson) {
  return lesson.markdown
    .split(/^## /m)
    .filter((s) => s.trim())
    .map((s) => ({
      title: s.split("\n")[0].trim(),
      markdown: s.slice(s.indexOf("\n")).trim(),
    }));
}
export function lessonProject(lesson: Lesson) {
  const preset = PRESETS.find((p) => p.id === lesson.preset)!;
  return { doc: preset.create(), sketch: preset.sketch };
}
