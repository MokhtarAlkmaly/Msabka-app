import { createFileRoute } from "@tanstack/react-router";
import Settings from "@/pages/Settings";

const title = "إدارة الإعدادات - نظام المسابقة الرمضانية";
const description =
  "إدارة الملف الشخصي والعام النشط وحالات الطلاب والأعمدة المخصصة في نظام المسابقة الرمضانية.";

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
