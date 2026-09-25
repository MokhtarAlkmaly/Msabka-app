export const esc = (s: string) =>
  (s || "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

export const riyal = (n: number) => `${Number(n || 0).toLocaleString()} ريال`;

export const printHtml = async (title: string, body: string, extraCss = "") => {
  const { printHtmlDocument } = await import("@/utils/nativePrint");
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <title>${esc(title)}</title>
    <style>
      body{font-family:'Traditional Arabic','Tahoma',sans-serif;direction:rtl;padding:24px;color:#222}
      h1{text-align:center;color:#0e6b3a;margin:0 0 4px}
      h2{color:#0e6b3a;border-bottom:2px solid #0e6b3a;padding-bottom:4px;margin-top:26px;font-size:18px}
      .sub{text-align:center;color:#666;margin-bottom:18px}
      .cards{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}
      .card{flex:1 1 150px;border:1px solid #cfe3d7;background:#f4faf6;border-radius:8px;padding:10px;text-align:center}
      .card span{display:block;font-size:12px;color:#5b6b62}
      .card b{font-size:17px;color:#0e6b3a}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border:1px solid #999;padding:6px 8px;text-align:right;vertical-align:top}
      th{background:#0e6b3a;color:#fff}
      .num{text-align:center;font-variant-numeric:tabular-nums}
      tfoot td{font-weight:bold;background:#eef7f1}
      .empty{text-align:center;color:#888;padding:8px}
      .thanks{margin-top:26px;text-align:center;font-size:15px;color:#0e6b3a;border-top:1px dashed #0e6b3a;padding-top:12px}
      @media print{@page{size:A4;margin:12mm}}
      ${extraCss}
    </style></head><body>${body}
    </body></html>`;
  printHtmlDocument(html, title);
};
