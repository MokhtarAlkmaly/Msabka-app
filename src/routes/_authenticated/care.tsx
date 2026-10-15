import { createFileRoute } from "@tanstack/react-router";
import CenterDepartment from "@/pages/CenterDepartment";

export const Route = createFileRoute("/_authenticated/care")({
  head: () => ({
    meta: [{ title: "قسم المساعدات والرعاية وكفالة الأيتام | مركز إنماء الأهلي الخيري" }],
  }),
  component: () => <CenterDepartment department="care" />,
});
