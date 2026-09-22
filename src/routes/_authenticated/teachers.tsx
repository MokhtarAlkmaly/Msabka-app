import { createFileRoute } from "@tanstack/react-router";
import Teachers from "@/pages/Teachers";

export const Route = createFileRoute("/_authenticated/teachers")({
  head: () => ({
    meta: [
      { title: "المعلمين والمعلمات والإكراميات - نظام إدارة مركز إنماء الأهلي الخيري" },
      {
        name: "description",
        content: "إدارة المعلمين والمعلمات وإكرامياتهم الشهرية في المسابقة الرمضانية.",
      },
      {
        property: "og:title",
        content: "المعلمين والمعلمات والإكراميات - نظام إدارة مركز إنماء الأهلي الخيري",
      },
      {
        property: "og:description",
        content: "إدارة المعلمين والمعلمات وإكرامياتهم الشهرية في المسابقة الرمضانية.",
      },
    ],
  }),
  component: Teachers,
});
