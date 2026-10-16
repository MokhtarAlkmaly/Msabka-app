import { createFileRoute } from "@tanstack/react-router";
import Install from "@/pages/Install";

const title = "تثبيت التطبيق | Markz Net — نسخة بلا إنترنت";
const description = "خطوات تثبيت تطبيق المسابقة الرمضانية على الجوال والحاسب.";

export const Route = createFileRoute("/install")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Install,
});
