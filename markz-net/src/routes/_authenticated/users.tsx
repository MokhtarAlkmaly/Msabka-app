import { createFileRoute } from "@tanstack/react-router";
import Users from "@/pages/Users";

const title = "إدارة المستخدمين | Markz Net — نسخة بلا إنترنت";
const description =
  "قائمة بكل مستخدمي النظام مع التحكم بصلاحياتهم والسماح لهم بالاطلاع على بيانات المسؤول أو إيقافه.";

export const Route = createFileRoute("/_authenticated/users")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Users,
});
