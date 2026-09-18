import { createFileRoute } from "@tanstack/react-router";
import Halaqat from "@/pages/Halaqat";

export const Route = createFileRoute("/_authenticated/halaqat")({
  head: () => ({
    meta: [
      { title: "إدارة الحلقات - نظام مركز إنماء" },
      { name: "description", content: "إدارة حلقات القرآن وربط الطلاب بالمعلمات حسب العام." },
    ],
  }),
  component: Halaqat,
});
