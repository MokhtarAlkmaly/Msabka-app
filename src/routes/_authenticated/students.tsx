import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

const title = "الطلاب - السجل الرسمي الشامل | مركز إنماء الأهلي الخيري";
const description =
  "سجل الطلاب الرسمي الشامل لكل الأعوام في حلقات القرآن الكريم - مركز إنماء الأهلي الخيري.";

/**
 * صفحة الطلاب الرئيسية والمستقلة: نفس السجل الشامل لكل الأعوام، لكن على
 * مسار خاص (/students) يظهر كصفحة أساسية في القائمة الجانبية. المسار
 * الرئيسي (/) يعرض نفس الصفحة أيضاً حتى لا يتعطل أي رابط قديم.
 */
export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Index,
});
