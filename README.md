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
