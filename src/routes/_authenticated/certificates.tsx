import { createFileRoute } from "@tanstack/react-router";
import Certificates from "@/pages/Certificates";

export const Route = createFileRoute("/_authenticated/certificates")({
  head: () => ({
    meta: [
      { title: "الشهادات والتكريم - نظام المسابقة الرمضانية" },
      { name: "description", content: "إصدار وطباعة شهادات التكريم للطالبات والمعلمات." },
      { property: "og:title", content: "الشهادات والتكريم - نظام المسابقة الرمضانية" },
      { property: "og:description", content: "إصدار وطباعة شهادات التكريم للطالبات والمعلمات." },
    ],
  }),
  component: Certificates,
});
