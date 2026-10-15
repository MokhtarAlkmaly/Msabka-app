import { createFileRoute } from "@tanstack/react-router";
import ExamQuestions from "@/pages/ExamQuestions";

export const Route = createFileRoute("/_authenticated/exam-questions")({
  head: () => ({
    meta: [
      { title: "أسئلة الاختبارات - مركز إنماء الأهلي الخيري" },
      { name: "description", content: "بنك أسئلة الاختبارات لإدارة أسئلة الحفظ والتلاوة." },
    ],
  }),
  component: ExamQuestions,
});
