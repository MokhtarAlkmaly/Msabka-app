import { createFileRoute } from "@tanstack/react-router";
import Media from "@/pages/Media";

export const Route = createFileRoute("/_authenticated/media")({
  head: () => ({
    meta: [
      { title: "الوسائط والصور - نظام إدارة Markz Net" },
      {
        name: "description",
        content: "معرض صور ووسائط المسابقة الرمضانية لMarkz Net.",
      },
      { property: "og:title", content: "الوسائط والصور - نظام إدارة Markz Net" },
      {
        property: "og:description",
        content: "معرض صور ووسائط المسابقة الرمضانية لMarkz Net.",
      },
    ],
  }),
  component: Media,
});
