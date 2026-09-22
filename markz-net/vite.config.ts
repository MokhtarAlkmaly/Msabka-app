// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// markz-net نسخة مستقلة تعمل بدون إنترنت: البناء دائماً يُخرج خادم Node.js
// عاديًا (node-server) يُشغَّل بـ `npm start` على الجهاز نفسه أو ضمن الشبكة
// المحلية — لا Vercel ولا Cloudflare ولا أي خدمة سحابية.
export default defineConfig({
  // Arena proxies the dev server through a generated preview hostname.
  // Allow that host while still binding Vite on all interfaces.
  vite: {
    server: {
      host: "0.0.0.0",
      allowedHosts: true,
    },
    ssr: {
      external: ["jspdf", "html2canvas"],
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: { preset: "node-server" },
});
