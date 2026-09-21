import { createFileRoute } from "@tanstack/react-router";
import Media from "@/pages/Media";

export const Route = createFileRoute("/_authenticated/media")({
  head: () => ({
    meta: [
      { title: "الوسائط والصور - نظام إدارة مركز إنماء الأهلي الخيري" },
      {
        name: "description",
        content: "معرض صور ووسائط المسابقة الرمضانية لمركز إنماء الأهلي الخيري.",
      },
      { property: "og:title", content: "الوسائط والصور - نظام إدارة مركز إنماء الأهلي الخيري" },
      {
        property: "og:description",
        content: "معرض صور ووسائط المسابقة الرمضانية لمركز إنماء الأهلي الخيري.",
      },
    ],
  }),
  component: Media,
});
