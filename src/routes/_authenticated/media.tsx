import { createFileRoute } from "@tanstack/react-router";
import Media from "@/pages/Media";

export const Route = createFileRoute("/_authenticated/media")({
  head: () => ({
    meta: [
      { title: "الوسائط والصور - نظام المسابقة الرمضانية" },
      { name: "description", content: "معرض صور ووسائط المسابقة الرمضانية لمركز إنماء الأهلي الخيري." },
      { property: "og:title", content: "الوسائط والصور - نظام المسابقة الرمضانية" },
      { property: "og:description", content: "معرض صور ووسائط المسابقة الرمضانية لمركز إنماء الأهلي الخيري." },
    ],
  }),
  component: Media,
});
