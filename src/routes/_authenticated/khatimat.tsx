import { createFileRoute } from "@tanstack/react-router";
import Khatimat from "@/pages/Khatimat";

export const Route = createFileRoute("/_authenticated/khatimat")({
  head: () => ({
    meta: [
      { title: "كشف الخاتمات - نظام المسابقة الرمضانية" },
      { name: "description", content: "قائمة الطالبات اللواتي ختمن القرآن الكريم عبر جميع الأعوام." },
      { property: "og:title", content: "كشف الخاتمات - نظام المسابقة الرمضانية" },
      { property: "og:description", content: "قائمة الطالبات اللواتي ختمن القرآن الكريم عبر جميع الأعوام." },
    ],
  }),
  component: Khatimat,
});
