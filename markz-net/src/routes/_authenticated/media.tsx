import { createFileRoute } from "@tanstack/react-router";
import Media from "@/pages/Media";

export const Route = createFileRoute("/_authenticated/media")({
  head: () => ({
    meta: [
      { title: "الوسائط والصور | Markz Net — نسخة بلا إنترنت" },
      {
        name: "description",
        content: "معرض صور ووسائط المسابقة الرمضانية لنظام Markz Net — نسخة بلا إنترنت.",
      },
      { property: "og:title", content: "الوسائط والصور | Markz Net — نسخة بلا إنترنت" },
      {
        property: "og:description",
        content: "معرض صور ووسائط المسابقة الرمضانية لنظام Markz Net — نسخة بلا إنترنت.",
      },
    ],
  }),
  component: Media,
});
