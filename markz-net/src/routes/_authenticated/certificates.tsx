import { createFileRoute } from "@tanstack/react-router";
import Certificates from "@/pages/Certificates";

export const Route = createFileRoute("/_authenticated/certificates")({
  head: () => ({
    meta: [
      { title: "الشهادات والتكريم | Markz Net — نسخة بلا إنترنت" },
      { name: "description", content: "إصدار وطباعة شهادات التكريم للطلاب والمعلمين والمعلمات." },
      { property: "og:title", content: "الشهادات والتكريم | Markz Net — نسخة بلا إنترنت" },
      {
        property: "og:description",
        content: "إصدار وطباعة شهادات التكريم للطلاب والمعلمين والمعلمات.",
      },
    ],
  }),
  component: Certificates,
});
