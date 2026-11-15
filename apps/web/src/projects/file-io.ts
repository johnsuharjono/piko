import { importProject } from "./store";
export async function readProjectFile(file: File) {
  if (file.size > 200000)
    throw new Error("Project files must be smaller than 200 KB.");
  return importProject(await file.text());
}
