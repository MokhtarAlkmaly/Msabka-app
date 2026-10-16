import { createFileRoute } from "@tanstack/react-router";
import MonthlyTrackingSearch from "@/pages/MonthlyTrackingSearch";

export const Route = createFileRoute("/monthly-search")({
  head: () => ({
    meta: [
      { title: "بحث المتابعة الشهرية | Markz Net — نسخة بلا إنترنت" },
      {
        name: "description",
        content:
          "سجل المتابعة الشهرية الكامل للطالب/ة خلال أشهر العام، بمقارنة نسب التقدم بالحفظ والمراجعة، قابل للطباعة والمشاركة.",
      },
      {
        property: "og:title",
        content: "بحث المتابعة الشهرية | Markz Net — نسخة بلا إنترنت",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MonthlyTrackingSearch,
});
