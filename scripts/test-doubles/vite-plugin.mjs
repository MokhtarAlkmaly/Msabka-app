/**
 * حقن بدائل الاختبار عبر إضافة Vite.
 *
 * الفكرة: اختبارات Node تشغّل وحدات التطبيق الحقيقية عبر `vite.ssrLoadModule`
 * (نفس دقة الأسماء المستعارة `@/` ونفس محوّل TypeScript)، لكن بعض الوحدات
 * تحتاج متصفحاً أو شبكة (SQLite، Supabase، الجلسة، وضع الاطلاع). بدلاً من
 * تكرار المنطق داخل الاختبار، يعيد خطاف `load` توجيه هذه الوحدات إلى بدائل
 * مكتوبة مرة واحدة في هذا المجلد.
 *
 * المزيّة: الوحدة **تحت الاختبار** (communityStorage/examStorage) تُحمَّل
 * حقيقيةً كما في التطبيق، والبديل يقتصر على حدودها الخارجية فقط.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

export const DOUBLES_DIR = path.dirname(fileURLToPath(import.meta.url));
export const SRC_DIR = fileURLToPath(new URL("../../src", import.meta.url));

/**
 * @param mappings خريطة: لاحقة مسار الوحدة الأصلية ← اسم ملف البديل هنا.
 *   مثال: `{ "/utils/localDB.ts": "localDB.mjs" }`
 */
export const createDoublesPlugin = (mappings) => ({
  name: "msabka-test-doubles",
  enforce: "pre",
  load(id) {
    for (const [suffix, doubleFile] of Object.entries(mappings)) {
      if (!id.endsWith(suffix)) continue;
      const target = path.resolve(DOUBLES_DIR, doubleFile);
      let relative = path.relative(path.dirname(id), target).split(path.sep).join("/");
      if (!relative.startsWith(".")) relative = `./${relative}`;
      return `export * from "${relative}";`;
    }
    return null;
  },
});

/** خادم Vite للاختبارات: نفس إعدادات التطبيق + بدائل حسب الطلب. */
export const createTestVite = async (mappings = {}) =>
  createServer({
    configFile: false,
    server: { middlewareMode: true },
    resolve: { alias: { "@": SRC_DIR } },
    plugins: [createDoublesPlugin(mappings)],
  });
