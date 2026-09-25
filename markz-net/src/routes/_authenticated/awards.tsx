import { createFileRoute } from "@tanstack/react-router";
import Awards from "@/pages/Awards";

export const Route = createFileRoute("/_authenticated/awards")({
  head: () => ({
    meta: [
      { title: "الجوائز والإكراميات - نظام إدارة Markz Net" },
      {
        name: "description",
        content: "متابعة جوائز وإكراميات الطلاب والمعلمين والمعلمات في المسابقة الرمضانية.",
      },
      {
        property: "og:title",
        content: "الجوائز والإكراميات - نظام إدارة Markz Net",
      },
      {
        property: "og:description",
        content: "متابعة جوائز وإكراميات الطلاب والمعلمين والمعلمات في المسابقة الرمضانية.",
      },
    ],
  }),
  component: Awards,
});
