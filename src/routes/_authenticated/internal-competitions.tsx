import { createFileRoute } from "@tanstack/react-router";
import InternalCompetitions from "@/pages/InternalCompetitions";

const title = "المسابقات الداخلية - مركز إنماء الأهلي الخيري";
const description =
  "كشف المسابقات القرآنية الداخلية - قسم القرآن الكريم";

export const Route = createFileRoute("/_authenticated/internal-competitions")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: InternalCompetitions,
});
