import { createFileRoute } from "@tanstack/react-router";
import Donors from "@/pages/Donors";

export const Route = createFileRoute("/_authenticated/donors")({
  head: () => ({
    meta: [
      { title: "المتبرعون والدعم - نظام إدارة مركز إنماء الأهلي الخيري" },
      { name: "description", content: "سجل المتبرعين ودعم المسابقة الرمضانية لحفظ القرآن الكريم." },
      { property: "og:title", content: "المتبرعون والدعم - نظام إدارة مركز إنماء الأهلي الخيري" },
      {
        property: "og:description",
        content: "سجل المتبرعين ودعم المسابقة الرمضانية لحفظ القرآن الكريم.",
      },
    ],
  }),
  component: Donors,
});
