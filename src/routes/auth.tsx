import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import Auth from "@/pages/Auth";
import { useAuth } from "@/hooks/useAuth";

const title = "تسجيل الدخول - نظام المسابقة الرمضانية";
const description = "الدخول إلى نظام إدارة المسابقة الرمضانية لحفظ القرآن الكريم.";

export const Route = createFileRoute("/auth")({
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
  component: AuthRoute,
});

function AuthRoute() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    navigate({ to: safe as never, replace: true });
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        جارٍ التحميل...
      </div>
    );
  }

  return <Auth />;
}
