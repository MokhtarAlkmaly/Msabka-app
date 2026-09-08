import { createFileRoute } from "@tanstack/react-router";
import Search from "@/pages/Search";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { title: "بحث عن طالبة - نظام المسابقة الرمضانية" },
      { name: "description", content: "بحث عن الطالبة وعرض سجلها الشامل لكل الأعوام مع الطباعة والتصدير والمشاركة." },
      { property: "og:title", content: "بحث عن طالبة - نظام المسابقة الرمضانية" },
      { property: "og:description", content: "سجل الطالبة الكامل لجميع الأعوام قابل للتعديل والطباعة والتصدير." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Search,
});
