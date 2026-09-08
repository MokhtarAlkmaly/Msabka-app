# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- SQLite محلي (@capacitor-community/sqlite)

## قاعدة البيانات المحلية (SQLite)

التخزين المحلي لم يعد يعتمد على IndexedDB، بل على قاعدة بيانات **SQLite حقيقية**:

- على **أندرويد** (تطبيق Capacitor): محرك SQLite الأصلي، ملف قاعدة بيانات حقيقي على الجهاز.
- على **الويب** (`npm run dev` أو أي استضافة ويب عادية): نفس الواجهة البرمجية، لكن عبر محرك sql.js/WASM (مكوّن `jeep-sqlite`)، والبيانات تُحفظ تلقائيًا داخل IndexedDB بشكل شفاف تمامًا عن باقي الكود.

كل هذا مُغلَّف داخل `src/utils/sqliteClient.ts` (الاتصال والسكيمة) و`src/utils/localDB.ts` (نفس دوال CRUD القديمة بالضبط)، لذا لا يوجد أي فرق في بقية الكود. عند أول تشغيل بعد هذا التحديث، يُنقَل تلقائيًا أي كاش أو تعديلات محلية غير متزامنة كانت مخزَّنة سابقًا في IndexedDB القديمة (`src/utils/migrateLegacyCache.ts`).

### خطوات مطلوبة بعد السحب

```sh
npm i                # يجلب @capacitor-community/sqlite وينسخ ملف sql-wasm.wasm تلقائيًا (postinstall)
npm run dev           # يعمل مباشرة على الويب

# لتطبيق أندرويد فقط:
npx cap sync android  # يُحدّث المشروع الأصلي ليشمل إضافة SQLite (لازم بعد أي تغيير في الحزم)
npx cap open android  # لفتح Android Studio والبناء
```

### التشغيل من Termux (بدون كمبيوتر)

`npm i` و`npm run dev` و`npx cap sync android` كلها أوامر Node.js عادية تعمل داخل Termux بدون مشاكل (لا تحتاج Android SDK). أما بناء ملف APK فعليًا (`gradlew assembleDebug`) فيحتاج JDK + Android SDK كاملين، وهذا غير عملي على Termux — البديل الجاهز هو ملف `.github/workflows/build-android.yml` المُرفَق: يبني الـ APK تلقائيًا على GitHub كل مرة تدفع فيها كودًا، وتُحمّل الملف الناتج مباشرة على التابلت وتثبّته. راجع تعليمات الاستخدام في نهاية هذا الملف.

## النشر على Vercel

الملفات اللازمة موجودة: `vercel.json`، `.vercelignore`، `.env.example`، وإعداد `vite.config.ts` الذي يبني بواسطة Nitro بقالب `vercel` تلقائيًا عندما يكون البناء على Vercel.

خطوات النشر:

1. ارفع المشروع إلى مستودع GitHub.
2. في Vercel: New Project → استورد المستودع.
3. اترك Framework Preset = Other. أمر البناء `npm run build` (مقروء من `vercel.json`).
4. أضف متغيرات البيئة من `.env.example` (نفس قيم قاعدة البيانات الحالية):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (نفس قيم الـ VITE)
5. اضغط Deploy. الناتج يُكتب في `.vercel/output` (Build Output API) ويتعرف عليه Vercel تلقائيًا.

ملاحظة: مجلد `android/` وملفات Capacitor لا تُنشر على Vercel (مستثناة في `.vercelignore`) ويمكن بناؤها محليًا كما هي.

## بناء ملف APK بدون كمبيوتر (GitHub Actions)

مناسب لمن يعمل من جهاز جوال/تابلت فقط (مثلاً عبر Termux) بدون Android Studio:

1. تأكد أن المشروع مرفوع على مستودع GitHub.
2. من إعدادات المستودع: **Settings → Secrets and variables → Actions → New repository secret**، أضف 3 أسرار بنفس أسماء المتغيرات في `.env.example`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
3. اذهب لتبويب **Actions** في المستودع، اختر workflow باسم "بناء تطبيق أندرويد (APK)"، ثم اضغط **Run workflow** (أو ادفع أي كوميت جديد ليعمل تلقائيًا).
4. بعد انتهاء التشغيل (بضع دقائق)، افتح تفاصيل التشغيل وحمّل الملف من قسم **Artifacts** باسم `app-debug-apk` — بداخله `app-debug.apk`.
5. انقل الملف إلى جهازك وثبّته مباشرة (فعّل "السماح بالتثبيت من مصادر غير معروفة" إن طُلب ذلك).
