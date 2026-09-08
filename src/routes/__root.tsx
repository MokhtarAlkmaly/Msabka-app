import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/hooks/useAuth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import NotFound from "@/pages/NotFound";

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          تعذر تحميل الصفحة
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          حدث خطأ غير متوقع. يمكنك المحاولة مرة أخرى أو العودة إلى الصفحة الرئيسية.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            إعادة المحاولة
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            الصفحة الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes",
      },
      { title: "نظام المسابقة الرمضانية - مركز إنماء" },
      {
        name: "description",
        content:
          "نظام إدارة المسابقة الرمضانية لحفظ القرآن الكريم - مركز إنماء الأهلي الخيري",
      },
      { name: "author", content: "مختار الكمالي" },
      { name: "keywords", content: "مسابقة رمضانية, حفظ القرآن, مركز إنماء, تحفيظ القرآن" },
      { name: "theme-color", content: "#047857" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "المسابقة الرمضانية" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "نظام المسابقة الرمضانية - مركز إنماء" },
      { name: "twitter:title", content: "نظام المسابقة الرمضانية - مركز إنماء" },
      { property: "og:description", content: "نظام إدارة المسابقة الرمضانية لحفظ القرآن الكريم - مركز إنماء الأهلي الخيري" },
      { name: "twitter:description", content: "نظام إدارة المسابقة الرمضانية لحفظ القرآن الكريم - مركز إنماء الأهلي الخيري" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/mWFry8G8Buho2HzXpjnpDi65haL2/social-images/social-1786984559832-social-image.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/mWFry8G8Buho2HzXpjnpDi65haL2/social-images/social-1786984559832-social-image.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {/* عنصر ويب مطلوب فقط عند التشغيل داخل متصفح عادي (وليس تطبيق أندرويد الأصلي)؛
            يوفّر محرك SQLite (sql.js) للمتصفح عبر @capacitor-community/sqlite. */}
        <jeep-sqlite />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
