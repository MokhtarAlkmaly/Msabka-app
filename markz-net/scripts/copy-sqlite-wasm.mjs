// ينسخ ملف sql-wasm.wasm (محرك SQLite في المتصفح) إلى public/assets
// حتى يستطيع مكوّن jeep-sqlite تحميله عند تشغيل التطبيق كموقع ويب عادي.
// لا تأثير لهذا الملف على تطبيق أندرويد (يستخدم SQLite الأصلي هناك).

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const src = resolve(projectRoot, "node_modules/sql.js/dist/sql-wasm.wasm");
const destDir = resolve(projectRoot, "public/assets");
const dest = resolve(destDir, "sql-wasm.wasm");

if (!existsSync(src)) {
  console.warn(
    "[copy-sqlite-wasm] لم يتم العثور على sql.js — سيتم تخطي النسخ (شغّل npm install أولاً).",
  );
  process.exit(0);
}

try {
  mkdirSync(destDir, { recursive: true });
  copyFileSync(src, dest);
  console.log("[copy-sqlite-wasm] تم نسخ sql-wasm.wasm إلى public/assets/");
} catch (err) {
  console.warn("[copy-sqlite-wasm] فشل نسخ sql-wasm.wasm:", err?.message ?? err);
}
