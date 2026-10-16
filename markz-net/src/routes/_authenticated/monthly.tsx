import { createFileRoute } from "@tanstack/react-router";
import MonthlyTracking from "@/pages/MonthlyTracking";

export const Route = createFileRoute("/_authenticated/monthly")({
  head: () => ({
    meta: [
      { title: "المتابعة الشهرية | Markz Net — نسخة بلا إنترنت" },
      {
        name: "description",
        content:
          "تسجيل الحفظ الجديد والمواظبة والسلوك شهرياً لكل طالب/ة، وتحديث النتيجة السنوية تلقائياً.",
      },
      { property: "og:title", content: "المتابعة الشهرية | Markz Net — نسخة بلا إنترنت" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MonthlyTracking,
});
