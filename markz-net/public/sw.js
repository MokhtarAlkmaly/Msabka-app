/**
 * Service Worker — Markz Net (نسخة بلا إنترنت — النظام المستقل)
 *
 * الهدف: بعد أول زيارة كاملة للنظام على هذا الجهاز، تعمل الواجهة حتى لو
 * أُغلق خادم Node المحلي مؤقتاً أو انقطع الاتصال بالشبكة المحلية:
 *
 *  - الأصول (JS/CSS/خطوط/أيقونات بنفس الأصل): cache-first — تُخدَّم فوراً
 *    من الكاش، وتُحدَّث في الخلفية عند توفر الشبكة.
 *  - التنقلات (فتح الصفحات): network-first — تُجرَّب الشبكة أولاً، وعند
 *    فشلها تُقدَّم آخر نسخة مخزنة لنفس الصفحة، وإلا صفحة "غير متصل".
 *
 * البيانات نفسها (الطلاب، المتابعة، الوسائط) لا تمر من هنا إطلاقاً —
 * تعيش في SQLite وIndexedDB داخل المتصفح.
 *
 * ملاحظة الهوية: هذا النظام منفصل تماماً عن تطبيق «مركز إنماء الأهلي الخيري»؛
 * له قاعدة بيانات واسم تخزين وكاش خاص به، فلا يستبدل بيانات التطبيق السابق.
 */

const VERSION = "markz-net-v2";
const ASSETS_CACHE = `${VERSION}-assets`;
const PAGES_CACHE = `${VERSION}-pages`;

/** صفحات النظام (تنقلات) التي نسمح بتخزين نسخة احتياطية منها. */
const APP_PAGES = [
  "/",
  "/auth",
  "/teacher",
  "/monthly",
  "/halaqat",
  "/competition",
  "/search",
  "/media",
  "/settings",
  "/users",
  "/teachers",
  "/awards",
  "/certificates",
  "/donors",
  "/expenses",
  "/internal-competitions",
  "/external-competitions",
  "/khatimat",
  "/submissions",
  "/portals",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES_CACHE);
      // صفحة عدم الاتصال أولاً — يجب أن تتوفر دائماً.
      await cache.add(new Request("/offline.html", { cache: "reload" }));
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // تنظيف كاشات الإصدارات القديمة.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

const isNavigation = (request) => request.mode === "navigate";

const isAsset = (request, url) =>
  !isNavigation(request) &&
  request.method === "GET" &&
  url.origin === self.location.origin &&
  !url.pathname.startsWith("/api/");

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // لا نتدخل في بيانات المتصفح أو الطلبات غير القابلة للتخزين.
  if (url.origin !== self.location.origin) return;
  if (request.method !== "GET") return;

  if (isNavigation(request)) {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isAsset(request, url)) {
    event.respondWith(handleAsset(request));
    return;
  }
});

/** تنقل: شبكة أولاً، ثم الكاش، ثم صفحة عدم الاتصال. */
async function handleNavigation(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && shouldCachePage(new URL(request.url).pathname)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const offline = await cache.match("/offline.html");
    if (offline) return offline;
    return new Response("غير متصل", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

/** أصل مُهشَّر: كاش أولاً مع تحديث خلفي. */
async function handleAsset(request) {
  const cache = await caches.open(ASSETS_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // تحديث خلفي هادئ للنسخة القادمة.
    quietUpdate(cache, request);
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response("", { status: 504 });
  }
}

/** تحديث خلفي لا يرمي أخطاءاً أبداً. */
async function quietUpdate(cache, request) {
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response);
  } catch {
    /* لا شيء — سنحاول لاحقاً */
  }
}

function shouldCachePage(pathname) {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return APP_PAGES.includes(clean);
}
