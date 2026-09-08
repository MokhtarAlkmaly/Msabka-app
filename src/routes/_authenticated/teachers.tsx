import { createFileRoute } from "@tanstack/react-router";
import Teachers from "@/pages/Teachers";

export const Route = createFileRoute("/_authenticated/teachers")({
  head: () => ({
    meta: [
      { title: "المعلمات والإكراميات - نظام المسابقة الرمضانية" },
      { name: "description", content: "إدارة المعلمات وإكرامياتهن الشهرية في المسابقة الرمضانية." },
      { property: "og:title", content: "المعلمات والإكراميات - نظام المسابقة الرمضانية" },
      { property: "og:description", content: "إدارة المعلمات وإكرامياتهن الشهرية في المسابقة الرمضانية." },
    ],
  }),
  component: Teachers,
});
