import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { generateSW } from "workbox-build";

if (process.env.CAPACITOR_BUILD) {
  console.log("[pwa] Native build: service worker disabled");
} else {
  // Nitro presets relocate client output; generate only after prerender/copy finishes.
  const roots = process.env.VERCEL ? [".vercel/output/static"] : [".output/public", "dist/client"];
  const root = roots.find((dir) => existsSync(resolve(dir, "_shell.html")));
  if (!root)
    throw new Error("[pwa] Anonymous _shell.html missing; refusing incomplete offline build");
  const { count, size, warnings } = await generateSW({
    globDirectory: root,
    swDest: resolve(root, "sw.js"),
    globPatterns: ["**/*.{js,css,wasm,woff,woff2,png,svg,ico,webmanifest}", "_shell.html"],
    globIgnores: ["sw.js", "workbox-*.js"],
    maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
    navigateFallback: "/_shell.html",
    navigateFallbackDenylist: [
      /^\/api(?:\/|$)/,
      /^\/_server(?:\/|$)/,
      /^\/_serverFn(?:\/|$)/,
      /^\/auth\/callback(?:\/|$)/,
      /^\/[^?]*\.[^/]+$/,
    ],
    // Wait for old tabs to close: never mix old JS with a new shell mid-session.
    skipWaiting: false,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    // No runtime caching: Supabase/API requests and signed media URLs stay private.
    runtimeCaching: [],
  });
  warnings.forEach((warning) => console.warn("[pwa]", warning));
  console.log(`[pwa] Precached ${count} assets (${Math.round(size / 1024)} KiB) in ${root}`);
}
