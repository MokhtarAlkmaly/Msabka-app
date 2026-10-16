import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/hooks/useAuth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import NotFound from "@/pages/NotFound";

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">تعذر تحميل الصفحة</h1>
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
      { title: "Markz Net — نسخة بلا إنترنت | نظام إدارة حلقات ومسابقات القرآن الكريم" },
      {
        name: "description",
        content:
          "Markz Net — نسخة بلا إنترنت: نظام إدارة حلقات ومسابقات القرآن الكريم يعمل بالكامل على الجهاز، وكل البيانات مخزّنة محلياً دون أي اتصال بالإنترنت.",
      },
      { name: "author", content: "مختار الكمالي" },
      {
        name: "keywords",
        content:
          "مسابقة رمضانية, حفظ القرآن, Markz Net, نسخة بلا إنترنت, تطبيق يعمل بدون إنترنت, تحفيظ القرآن",
      },
      { name: "theme-color", content: "#047857" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Markz Net" },
      { name: "application-name", content: "Markz Net — نسخة بلا إنترنت" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:title",
        content: "Markz Net — نسخة بلا إنترنت | نظام إدارة حلقات ومسابقات القرآن الكريم",
      },
      {
        name: "twitter:title",
        content: "Markz Net — نسخة بلا إنترنت | نظام إدارة حلقات ومسابقات القرآن الكريم",
      },
      {
        property: "og:description",
        content:
          "Markz Net — نسخة بلا إنترنت: كل البيانات (الطلاب، المتابعة الشهرية، المسابقات، الوسائط) مخزّنة على جهازك.",
      },
      {
        name: "twitter:description",
        content:
          "Markz Net — نسخة بلا إنترنت: كل البيانات (الطلاب، المتابعة الشهرية، المسابقات، الوسائط) مخزّنة على جهازك.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
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
        {/* ملاحظة أداء: عنصر <jeep-sqlite> لم يعد يُزرع هنا. كان وجوده يعني تحميل
            محرك SQLite/WASM (~1 ميجابايت) على كل صفحة بما فيها صفحة تسجيل الدخول.
            صار sqliteClient هو من يُنشئه عند أول استخدام فعلي للقاعدة (بعد الدخول). */}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // تسجيل service worker في نسخة الإنتاج فقط (نسخة احتياطية للواجهة عند
  // انقطاع الخادم المحلي). يُتخطى داخل تطبيق أندرويد — أصوله محلية أصلاً.
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) return;
        if (cancelled) return;
        await navigator.serviceWorker.register("/sw.js");
      } catch (err) {
        console.warn("تعذّر تسجيل service worker", err);
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
