import type { DetailedHTMLProps, HTMLAttributes } from "react";

// يسمح لـ TypeScript/JSX بقبول <jeep-sqlite /> كعنصر ويب مخصّص (Stencil web component)
// يستخدمه @capacitor-community/sqlite لتشغيل SQLite داخل المتصفح.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "jeep-sqlite": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
