import { createFileRoute } from "@tanstack/react-router";
import Donors from "@/pages/Donors";

export const Route = createFileRoute("/_authenticated/donors")({
  head: () => ({
    meta: [
      { title: "المتبرعون والدعم | Markz Net — نسخة بلا إنترنت" },
      { name: "description", content: "سجل المتبرعين ودعم المسابقة الرمضانية لحفظ القرآن الكريم." },
      { property: "og:title", content: "المتبرعون والدعم | Markz Net — نسخة بلا إنترنت" },
      {
        property: "og:description",
        content: "سجل المتبرعين ودعم المسابقة الرمضانية لحفظ القرآن الكريم.",
      },
    ],
  }),
  component: Donors,
});
