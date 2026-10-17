import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  /**
   * حالة درج القائمة على الشاشات الأصغر من 1024px. تعيش هنا في التخطيط لأن
   * كلاً من `AppSidebar` و`CenterSectionTabs` يحتاجان التحكم بها: اختيار صفحة
   * من القائمة أو قسم من الشريط العلوي يُغلق الدرج فوراً.
   */
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // أي تنقّل بين الصفحات يُغلق الدرج حتى لا يبقى مفتوحاً فوق المحتوى.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  /**
   * إذا اتسعت الشاشة إلى 1024px فأكثر (تكبير النافذة أو تدوير الجهاز) يعود
   * الشريط ثابتاً على اليمين، فنُغلق الدرج حتى لا تبقى حالته مفتوحة ومعها
   * قفل تمرير الصفحة.
   */
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const wideScreen = window.matchMedia("(min-width: 1024px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileNavOpen(false);
    };
    wideScreen.addEventListener("change", onChange);
    return () => wideScreen.removeEventListener("change", onChange);
  }, []);

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
      <AppSidebar mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />
      {/* الشريط ثابت على اليمين في الشاشات الواسعة (1024px فأكثر)، و`.app-main`
          في styles.css تحجز عرضه (margin-right: 18rem) حتى لا تتداخل الصفحات
          معه. تحت 1024px يتحول الشريط إلى درج يُغلق بعد الاختيار، فتُلغى
          الإزاحة ويأخذ المحتوى عرض الشاشة كاملاً. */}
      <main className="app-main min-h-screen min-w-0">
        {/* يظهر فقط أثناء الاطلاع على بيانات مستخدم آخر (قراءة فقط) */}
        <ViewAsBanner />
        <CenterSectionTabs onSectionSelect={() => setMobileNavOpen(false)} />
        <Outlet />
      </main>
    </div>
  );
}
