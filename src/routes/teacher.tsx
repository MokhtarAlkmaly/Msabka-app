import { createFileRoute } from "@tanstack/react-router";
import TeacherPortal from "@/pages/TeacherPortal";

// بوابة المعلم/ة — مسار عام بدون تسجيل دخول:
// /teacher?t=<code>&y=<year>&m=<month>
export const Route = createFileRoute("/teacher")({
  component: TeacherPortal,
});
