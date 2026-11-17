import { decodeProject } from "./format";
import { projectContent } from "@piko/project-model";
export async function readProjectFile(file: File) {
  if (file.size > 200000)
    throw new Error("Project files must be smaller than 200 KB.");
  return projectContent(decodeProject(await file.text()));
}
