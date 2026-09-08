import { createFileRoute } from "@tanstack/react-router";
import MonthlyTrackingSearch from "@/pages/MonthlyTrackingSearch";

export const Route = createFileRoute("/monthly-search")({
  head: () => ({
    meta: [
      { title: "بحث المتابعة الشهرية - نظام المسابقة الرمضانية" },
      { name: "description", content: "سجل المتابعة الشهرية الكامل للطالبة خلال أشهر العام، بمقارنة نسب التقدم بالحفظ والمراجعة، قابل للطباعة والمشاركة." },
      { property: "og:title", content: "بحث المتابعة الشهرية - نظام المسابقة الرمضانية" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MonthlyTrackingSearch,
});
