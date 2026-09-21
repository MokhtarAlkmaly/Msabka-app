import { createFileRoute } from "@tanstack/react-router";
import Expenses from "@/pages/Expenses";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [
      { title: "مصروفات حفل التكريم - نظام إدارة مركز إنماء الأهلي الخيري" },
      { name: "description", content: "تتبع مصروفات حفل تكريم حافظات القرآن الكريم." },
      {
        property: "og:title",
        content: "مصروفات حفل التكريم - نظام إدارة مركز إنماء الأهلي الخيري",
      },
      { property: "og:description", content: "تتبع مصروفات حفل تكريم حافظات القرآن الكريم." },
    ],
  }),
  component: Expenses,
});
