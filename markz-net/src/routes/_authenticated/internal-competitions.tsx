import { createFileRoute } from "@tanstack/react-router";
import InternalCompetitions from "@/pages/InternalCompetitions";

const title = "المسابقات الداخلية | Markz Net — نسخة بلا إنترنت";
const description = "كشف المسابقات القرآنية الداخلية - قسم القرآن الكريم";

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
