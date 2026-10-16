# AGENTS.md — Markz Net (نسخة مستقلة بدون إنترنت)

Markz Net نسخة مستقلة بالكامل من نظام إدارة حلقات ومسابقات القرآن الكريم،
مبنيّة على مستودع Msabka-app الأصلي ومحوّلة للعمل محلياً بدون أي إنترنت أو
خدمات سحابية.

## القاعدة الذهبية

**لا يوجد أي اتصال شبكي في هذا التطبيق.** لا Supabase ولا أي API خارجي.
كل البيانات تعيش على الجهاز:

- **قاعدة البيانات:** SQLite واحدة عبر jeep-sqlite (المتصفح) أو
  @capacitor-community/sqlite (أندرويد) — الاسم `markznet_local`.
- **ملفات الوسائط:** مخزن IndexedDB باسم `markznet_media` (صور/فيديو كـ Blob).
- **الجلسة:** `localStorage` بمفتاح `markznet.session` (تحقق من جدول app_users).

## الهوية (مهمة قبل أي تعديل مرئي)

هذا المشروع هو **Markz Net — نسخة بلا إنترنت**، وهو منفصل تماماً عن تطبيق
«مركز إنماء الأهلي الخيري» السحابي (معرّفه `org.inmaa.msabkarmdan` وقاعدته
`inmaa_local`). لا تخلط بينهما ولا تعد إلى معرّفات التطبيق السابق.

- نصوص الاسم والوسم والترويسات: `src/lib/brand.ts` فقط (لا تكتب «Markz Net» نصّاً
  داخل الصفحات). الشارات: `src/components/OfflineBadge.tsx`.
- الأيقونات والشعار وشاشات البداية تُولَّد بـ `npm run brand:assets`
  (المولّد: `scripts/generate-brand-assets.mjs` والخطوط في `scripts/brand-fonts/`).
- لا تُغيّر `appId` (`net.markz.app`) ولا `DB_NAME` (`markznet_local`) ولا مفاتيح
  `markznet.*` في localStorage — تغييرها يفقد المستخدمين بياناتهم.
- التفاصيل الكاملة: `docs/الهوية-وتمييز-النسختين.md`.

## البنية المحلية

| الملف | الدور |
| --- | --- |
| `src/utils/sqliteClient.ts` | فتح القاعدة + المخطط الكامل (كل الجداول مع `user_id`) |
| `src/utils/localDB.ts` | طبقة CRUD فوق SQLite (كاش + استعلامات مفلترة بالمستخدم) |
| `src/utils/localAuth.ts` | مصادقة محلية (PBKDF2) — أول حساب يصبح admin |
| `src/utils/users.ts` | إدارة المستخدمين والصلاحيات ومنح الاطلاع |
| `src/utils/storage.ts` | واجهة البيانات للصفحات (كانت سحابية — صارت محلية بالكامل) |
| `src/utils/teacherPortal.ts` | روابط المعلمين/المعلمات + وارد الترسيلات الشهرية |
| `src/utils/mediaStore.ts` | متجر وسائط IndexedDB |
| `src/utils/viewAs.ts` | وضع "الاطلاع على بيانات مستخدم آخر" (قراءة فقط) |

## عزل بيانات المستخدمين

كل جدول بيانات يحمل عمود `user_id`، وكل قراءة/كتابة تُفلتر به. حذف قاعدة
بيانات مستخدم (`deleteEntireDatabase` → `deleteAllRowsForUser`) يمسح صفوفه
فقط ويُبقي حسابات الآخرين. الإعدادات تُخزَّن ب مفاتيح مقيدة:
`${userId}:active_year` إلخ.

## الأوامر

```bash
npm install          # تثبيت (ينفّذ copy-sqlite-wasm.mjs تلقائياً)
npm run dev          # تطوير
npm run build        # بناء الإنتاج (خادم node-server في .output/)
npm start            # تشغيل خادم الإنتاج: node .output/server/index.mjs
npm run lint         # ESLint
npx tsc --noEmit     # فحص الأنواع
npm run test:db      # اختبار القاعدة المحلية (sql.js)
npm run test:integration  # اختبارات تكاملية: مصادقة/صلاحيات/عزل/بوابة معلمين
```

## عند التعديل

- لا تستورد أي شيء من `@/integrations` — الحزمة حُذفت نهائياً.
- `syncToCloud` في storage.ts أصبحت no-op للتوافق؛ لا تضف منطقاً سحابياً.
- `markDirty` no-op أيضاً — لا "تغييرات معلقة" بعد الآن.
- بعد أي تعديل شامل شغّل: `npx prettier --write` على الملفات المعدلة ثم
  `npm run lint` (العربية وحساسية المسافات).
- المعرفات المحلية: الطلاب بتسلسل طبيعي يبدأ من 1، والكيانات الأخرى UUID.

## ملاحظات

- الرسم من UMD عبر .lovable محذوف؛ البناء عبر @lovable.dev/vite-tanstack-config
  مع `nitro: { preset: "node-server" }` دائماً.
- التطبيق أحادي الخادم: تشغيله على جهاز واحد يخدم الشبكة المحلية عبر
  `HOSTNAME=0.0.0.0 PORT=8080 npm start` — كل متصفح يحتفظ ببياته محلياً
  (IndexedDB خاص بالمتصفح)، والمشاركة الكاملة عبر منح الاطلاع تعمل داخل
  نفس المتصفح/الجهاز، أو عبر تطبيق أندرويد لجهاز واحد.
