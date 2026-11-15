import { createFileRoute } from "@tanstack/react-router";
import { ProjectWorkspace } from "../components/project-workspace";
export const Route = createFileRoute("/bench/$projectId")({ component: Page });
function Page() {
  const { projectId } = Route.useParams();
  return <ProjectWorkspace key={projectId} id={projectId} />;
}
