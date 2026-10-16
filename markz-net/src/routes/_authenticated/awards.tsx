import { createFileRoute } from "@tanstack/react-router";
import Awards from "@/pages/Awards";

export const Route = createFileRoute("/_authenticated/awards")({
  head: () => ({
    meta: [
      { title: "الجوائز والإكراميات | Markz Net — نسخة بلا إنترنت" },
      {
        name: "description",
        content: "متابعة جوائز وإكراميات الطلاب والمعلمين والمعلمات في المسابقة الرمضانية.",
      },
      {
        property: "og:title",
        content: "الجوائز والإكراميات | Markz Net — نسخة بلا إنترنت",
      },
      {
        property: "og:description",
        content: "متابعة جوائز وإكراميات الطلاب والمعلمين والمعلمات في المسابقة الرمضانية.",
      },
    ],
  }),
  component: Awards,
});
