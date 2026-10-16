import { Capacitor } from "@capacitor/core";

export async function registerOfflineApp() {
  if (import.meta.env.DEV || typeof window === "undefined" || Capacitor.isNativePlatform()) return;
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  } catch (error) {
    // Online functionality must survive blocked/unavailable service workers.
    console.warn("تعذّر تجهيز التطبيق للعمل بدون إنترنت", error);
  }
}
