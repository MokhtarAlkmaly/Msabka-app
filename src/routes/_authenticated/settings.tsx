import { createFileRoute } from "@tanstack/react-router";
import Settings from "@/pages/Settings";

const title = "إدارة الإعدادات - نظام إدارة مركز إنماء الأهلي الخيري";
const description =
  "إدارة الملف الشخصي والعام النشط وحالات الطلاب والأعمدة المخصصة في نظام إدارة مركز إنماء الأهلي الخيري.";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Settings,
});
