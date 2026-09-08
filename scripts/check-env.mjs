// تحقق من وجود متغيرات بيئة Supabase قبل البناء (fail-fast).
// يتخطى بيئة Lovable sandbox تلقائيًا حتى لا يعطّل بناء المنصة.
// يقرأ process.env أولاً (يحقنه Vercel) ثم يدمج مع .env المحلي إن وجد.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SANDBOX =
  process.env.LOVABLE_SANDBOX === "1" || !!process.env.DEV_SERVER__PROJECT_PATH;
if (SANDBOX) {
  console.log("[env-check] داخل بيئة Lovable — تخطي الفحص.");
  process.exit(0);
}

// محلّل .env بسيط بدون أي اعتماديات
function loadEnvFile(filePath) {
  const vars = {};
  if (!existsSync(filePath)) return vars;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // إزالة علامات الاقتباس المحيطة
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const fileEnv = loadEnvFile(resolve(process.cwd(), ".env"));
const env = { ...fileEnv, ...process.env };

const required = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PROJECT_ID",
];

const missing = required.filter((key) => !env[key]);

if (missing.length > 0) {
  console.error("\n❌ فحص متغيرات البيئة: متغيرات ناقصة!");
  console.error("   المتغيرات الناقصة:");
  for (const key of missing) console.error(`     - ${key}`);
  console.error("\n   الحل:");
  console.error("   • محليًا: أضفها إلى ملف .env (راجع .env.example).");
  console.error(
    "   • على Vercel: Project Settings → Environment Variables، أضف المتغيرات الناقصة ثم أعِد النشر."
  );
  console.error(
    "   • أو عيّنها مؤقتًا: VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... npm run build\n"
  );
  process.exit(1);
}

console.log("[env-check] ✅ كل متغيرات Supabase مفقودة موجودة.");
for (const key of required) {
  const val = env[key];
  console.log(`   ${key} = ${val.length > 40 ? val.slice(0, 40) + "…" : val}`);
}
