import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { CenterSectionTabs } from "@/components/CenterSectionTabs";
import { AppSidebar } from "@/components/AppSidebar";
import { ViewAsBanner } from "@/components/ViewAsBanner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession reads the persisted session locally, so an authenticated user
    // can still open the offline-first registry without a network round trip.
    const { data, error } = await supabase.auth.getSession().catch(() => ({
      data: { session: null },
      error: null,
    }));
    if (!error && data.session?.user) return { user: data.session.user };

    /**
     * بدون نت (أو بعد انتهاء صلاحية رمز الوصول) تكفي الجلسة المحلية المفتوحة:
     * إما هوية حساب محفوظة + رمز PIN، أو «وضع الجهاز». بهذا لا يُطرد المستخدم
     * إلى شاشة الدخول وهو في منتصف الإدخال.
     */
    const { getLocalSession } = await import("@/utils/localAuth");
    const local = await getLocalSession().catch(() => null);
    if (local) {
      return {
        user: {
          id: local.user_id,
          email: local.email ?? undefined,
          user_metadata: { full_name: local.name ?? "", offline: true, mode: local.mode },
        },
      };
    }

    throw redirect({ to: "/auth" });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  // تهيئة قاعدة البيانات المحلية (SQLite/WASM ~1MB) تحدث هنا فقط — أي بعد
  // تسجيل الدخول — بدل تحميلها على كل صفحة من الجذر. صفحة الدخول تبقى خفيفة.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getDB } = await import("@/utils/sqliteClient");
        await getDB();
        if (cancelled) return;
        const { migrateLegacyIndexedDbCache } = await import("@/utils/migrateLegacyCache");
        await migrateLegacyIndexedDbCache();
      } catch (err) {
        console.error("تعذّرت تهيئة قاعدة البيانات المحلية (SQLite)", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen" dir="rtl">
      <AppSidebar />
      {/* AppSidebar is fixed on desktop; reserve its width so pages do not sit
          underneath it. The margin is removed on mobile where it becomes a drawer. */}
      <main className="min-h-screen min-w-0 md:mr-72">
        {/* يظهر فقط أثناء الاطلاع على بيانات مستخدم آخر (قراءة فقط) */}
        <ViewAsBanner />
        <CenterSectionTabs />
        <Outlet />
      </main>
    </div>
  );
}
