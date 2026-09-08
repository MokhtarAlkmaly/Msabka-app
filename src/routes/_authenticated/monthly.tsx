import { createFileRoute } from "@tanstack/react-router";
import MonthlyTracking from "@/pages/MonthlyTracking";

export const Route = createFileRoute("/_authenticated/monthly")({
  head: () => ({
    meta: [
      { title: "المتابعة الشهرية - نظام المسابقة الرمضانية" },
      { name: "description", content: "تسجيل الحفظ الجديد والمواظبة والسلوك شهرياً لكل طالبة، وتحديث النتيجة السنوية تلقائياً." },
      { property: "og:title", content: "المتابعة الشهرية - نظام المسابقة الرمضانية" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MonthlyTracking,
});
