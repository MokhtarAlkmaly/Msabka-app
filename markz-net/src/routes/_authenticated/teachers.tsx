import { createFileRoute } from "@tanstack/react-router";
import Teachers from "@/pages/Teachers";

export const Route = createFileRoute("/_authenticated/teachers")({
  head: () => ({
    meta: [
      { title: "المعلمين والمعلمات والإكراميات | Markz Net — نسخة بلا إنترنت" },
      {
        name: "description",
        content: "إدارة المعلمين والمعلمات وإكرامياتهم الشهرية في المسابقة الرمضانية.",
      },
      {
        property: "og:title",
        content: "المعلمين والمعلمات والإكراميات | Markz Net — نسخة بلا إنترنت",
      },
      {
        property: "og:description",
        content: "إدارة المعلمين والمعلمات وإكرامياتهم الشهرية في المسابقة الرمضانية.",
      },
    ],
  }),
  component: Teachers,
});
