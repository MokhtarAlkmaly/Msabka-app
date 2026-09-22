import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { ViewAsBanner } from "@/components/ViewAsBanner";
import { getSessionUser } from "@/utils/localAuth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // الجلسة محلية بالكامل: تُقرأ من التخزين المحلي وقاعدة SQLite على
    // الجهاز دون أي اتصال شبكي.
    const user = await getSessionUser().catch(() => null);
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  // تهيئة قاعدة البيانات المحلية (SQLite/WASM ~1MB) تحدث هنا فقط — أي بعد
  // تسجيل الدخول — بدل تحميلها على كل صفحة من الجذر. صفحة الدخول تهيئها
  // بنفسها عند الحاجة (المصادقة المحلية تحتاجها).
  useEffect(() => {
    (async () => {
      try {
        const { getDB } = await import("@/utils/sqliteClient");
        await getDB();
      } catch (err) {
        console.error("تعذّرت تهيئة قاعدة البيانات المحلية (SQLite)", err);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen" dir="rtl">
      <AppSidebar />
      {/* AppSidebar is fixed on desktop; reserve its width so pages do not sit
          underneath it. The margin is removed on mobile where it becomes a drawer. */}
      <main className="min-h-screen min-w-0 md:mr-72">
        {/* يظهر فقط أثناء الاطلاع على بيانات مستخدم آخر (قراءة فقط) */}
        <ViewAsBanner />
        <Outlet />
      </main>
    </div>
  );
}
