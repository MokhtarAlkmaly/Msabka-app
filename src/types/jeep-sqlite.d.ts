// يسمح لـ TypeScript/JSX بقبول <jeep-sqlite /> كعنصر ويب مخصّص (Stencil web component)
// يستخدمه @capacitor-community/sqlite لتشغيل SQLite داخل المتصفح.
declare namespace JSX {
  interface IntrinsicElements {
    "jeep-sqlite": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
  }
}
