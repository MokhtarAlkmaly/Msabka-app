import { createFileRoute } from "@tanstack/react-router";
import OverdueAlerts from "@/pages/OverdueAlerts";

const title = "المتأخرات والتنبيهات الذكية - نظام إدارة مركز إنماء الأهلي الخيري";
const description =
  "كشف تلقائي بكل ما ينقص: متابعات شهرية غير مسجّلة، إكراميات غير محفوظة، تعهّدات داعمين غير مكتملة، وبيانات مصروفات ناقصة — مع الطباعة والنسخ.";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OverdueAlerts,
});
