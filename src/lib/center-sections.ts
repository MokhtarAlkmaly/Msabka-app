import { BookOpen, GraduationCap, HeartHandshake } from "lucide-react";

export const centerSections = [
  {
    id: "quran",
    to: "/",
    label: "القرآن الكريم",
    title: "قسم القرآن الكريم",
    description: "نظام الإدارة وسجل الطلاب الشامل",
    icon: BookOpen,
  },
  {
    id: "training",
    to: "/training",
    label: "التدريب والتأهيل",
    title: "قسم التدريب والتأهيل",
    description: "الدورات والبرامج التدريبية والتأهيلية",
    icon: GraduationCap,
  },
  {
    id: "care",
    to: "/care",
    label: "المساعدات والرعاية وكفالة الأيتام",
    title: "قسم المساعدات والرعاية وكفالة الأيتام",
    description: "المساعدات الإنسانية والرعاية وكفالة الأيتام",
    icon: HeartHandshake,
  },
] as const;

export type CenterSectionId = (typeof centerSections)[number]["id"];

export function getCenterSection(pathname: string) {
  return (
    centerSections.find(
      (section) =>
        section.to !== "/" && (pathname === section.to || pathname.startsWith(`${section.to}/`)),
    ) ?? centerSections[0]
  );
}
