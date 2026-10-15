import { createFileRoute } from "@tanstack/react-router";
import CenterDepartment from "@/pages/CenterDepartment";

export const Route = createFileRoute("/_authenticated/training")({
  head: () => ({
    meta: [{ title: "قسم التدريب والتأهيل | مركز إنماء الأهلي الخيري" }],
  }),
  component: () => <CenterDepartment department="training" />,
});
