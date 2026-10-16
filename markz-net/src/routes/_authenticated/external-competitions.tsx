import { createFileRoute } from "@tanstack/react-router";
import ExternalCompetitions from "@/pages/ExternalCompetitions";

const title = "المسابقات الخارجية | Markz Net — نسخة بلا إنترنت";
const description = "كشف مشاركات المسابقات القرآنية الخارجية - قسم القرآن الكريم";

export const Route = createFileRoute("/_authenticated/external-competitions")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: ExternalCompetitions,
});
