// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// On Vercel (env var VERCEL=1) build with Nitro's vercel preset -> .vercel/output
// Locally / on Lovable the default target is kept.
const isVercel = !!process.env["VERCEL"];

// عند بناء تطبيق Capacitor (أندرويد) نحتاج خادم Node.js عادي وبسيط (بدل هدف
// Cloudflare الافتراضي) حتى نقدر نشغّله مؤقتًا ونسحب منه صفحة HTML جاهزة لملء
// index.html الثابت الذي يحتاجه Capacitor. نفعّل هذا فقط عبر متغير بيئة
// CAPACITOR_BUILD=1 (مضبوط محليًا أو في GitHub Actions)، دون أي تأثير على بناء
// الويب العادي (Vercel أو الافتراضي).
const isCapacitorBuild = !!process.env["CAPACITOR_BUILD"];

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  ...(isVercel
    ? { nitro: { preset: "vercel" } }
    : isCapacitorBuild
      ? { nitro: { preset: "node-server" } }
      : {}),
});
