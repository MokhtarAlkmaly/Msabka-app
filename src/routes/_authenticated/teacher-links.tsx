import { createFileRoute } from "@tanstack/react-router";
import TeacherLinks from "@/pages/TeacherLinks";

export const Route = createFileRoute("/_authenticated/teacher-links")({
  component: TeacherLinks,
});
