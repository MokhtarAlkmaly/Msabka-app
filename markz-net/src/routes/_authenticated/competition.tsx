import { createFileRoute } from "@tanstack/react-router";
import Competition from "@/pages/Competition";

const title = "المسابقة الرمضانية | Markz Net — نسخة بلا إنترنت";
const description = "كشوفات المسابقة الرمضانية ومسابقة عشر ذي الحجة - قسم القرآن الكريم";

export const Route = createFileRoute("/_authenticated/competition")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Competition,
});
