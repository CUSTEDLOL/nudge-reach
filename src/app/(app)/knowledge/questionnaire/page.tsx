import { permanentRedirect } from "next/navigation";

/** The questionnaire moved with the rest of the agent to /agent. */
export default function QuestionnaireRedirect() {
  permanentRedirect("/agent/questionnaire");
}
