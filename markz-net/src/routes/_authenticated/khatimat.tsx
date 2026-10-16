import { createFileRoute } from "@tanstack/react-router";
import Khatimat from "@/pages/Khatimat";

export const Route = createFileRoute("/_authenticated/khatimat")({
  head: () => ({
    meta: [
      { title: "كشف الخاتمين والخاتمات | Markz Net — نسخة بلا إنترنت" },
      {
        name: "description",
        content: "قائمة الطلاب الذين ختمن القرآن الكريم عبر جميع الأعوام.",
      },
      {
        property: "og:title",
        content: "كشف الخاتمين والخاتمات | Markz Net — نسخة بلا إنترنت",
      },
      {
        property: "og:description",
        content: "قائمة الطلاب الذين ختمن القرآن الكريم عبر جميع الأعوام.",
      },
    ],
  }),
  component: Khatimat,
});
