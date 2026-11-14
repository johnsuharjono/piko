import { createFileRoute } from "@tanstack/react-router";
import { ProjectIntro } from "../components/project-intro";
export const Route = createFileRoute("/learn/$lessonId")({ component: Page });
function Page() {
  const { lessonId } = Route.useParams();
  return <ProjectIntro id={lessonId} />;
}
