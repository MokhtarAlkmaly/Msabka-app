import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

const title = "Markz Net — نسخة بلا إنترنت | سجل الطلاب الرسمي";
const description =
  "السجل الرسمي لطلاب حلقات القرآن الكريم ونظام إدارة المسابقات | Markz Net — نسخة بلا إنترنت.";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Index,
});
