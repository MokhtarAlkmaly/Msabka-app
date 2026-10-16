import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Home, Loader2, Printer, Share2, Sparkles, Search as SearchIcon } from "lucide-react";
import logo from "@/assets/logo.png";
import { BRAND_PRINT_TITLE } from "@/lib/brand";
import { loadKhatimat, KhatimEntry } from "@/utils/storage";
import { printHtml, esc } from "@/utils/report";

const Khatimat = () => {
  const [entries, setEntries] = useState<KhatimEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    loadKhatimat().then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return entries;
    return entries.filter((e) => e.name.includes(q));
  }, [entries, query]);

  // إحصائيات: عدد الخاتمين بكل عام
  const byYear = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e) => map.set(e.year, (map.get(e.year) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries]);

  const buildBody = () => `
    <div class="head">
      <img src="${logo}" class="logo" />
      <div>
        <h1>${BRAND_PRINT_TITLE}</h1>
        <div class="sub">كشف الخاتمين والخاتمات — إجمالي ${entries.length} طالب/ة</div>
      </div>
    </div>
    <table>
      <thead><tr><th>م</th><th>الاسم</th><th>المعلم/ة</th><th>عام الختم</th><th>المجموع</th><th>التقدير</th></tr></thead>
      <tbody>
        ${filtered
          .map(
            (e, i) => `
          <tr>
            <td class="num">${i + 1}</td>
            <td>${esc(e.name)}</td>
            <td>${esc(e.teacher)}</td>
            <td class="num">${esc(e.year)}هـ</td>
            <td class="num">${esc(e.totalScore)}</td>
            <td>${esc(e.grade)}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>
    <div class="thanks">بارك الله في الخاتمين والخاتمات، وجعل القرآن حجّة لهم لا عليهم</div>
  `;

  const handlePrint = () => printHtml("كشف الخاتمين والخاتمات", buildBody());

  const handleShare = async () => {
    const { printHtmlDocument } = await import("@/utils/nativePrint");
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف الخاتمين والخاتمات</title>
      <style>
        body{font-family:Tahoma,Arial,sans-serif;padding:20px;color:#222}
        h1{text-align:center;color:#0e6b3a}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}
        th,td{border:1px solid #999;padding:5px;text-align:center}
        th{background:#0e6b3a;color:#fff}
      </style></head><body>${buildBody()}</body></html>`;
    await printHtmlDocument(html, "كشف_الخاتمين");
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6" dir="rtl">
      <div className="mx-auto max-w-5xl space-y-4">
        <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/20 p-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="شعار المركز" className="h-12 w-12 object-contain" />
            <div>
              <h1 className="flex items-center gap-1.5 text-lg font-bold text-primary">
                <Sparkles className="h-4 w-4 text-amber-500" /> كشف الخاتمين والخاتمات
              </h1>
              <p className="text-xs text-muted-foreground">
                يتحدّث تلقائياً كل ما طالب/ة يختم القرآن الكريم بأي عام
              </p>
            </div>
          </div>
          <Link to="/">
            <Button variant="outline" size="sm" className="gap-1">
              <Home className="h-4 w-4" /> الرئيسية
            </Button>
          </Link>
        </Card>

        {!loading && entries.length > 0 && (
          <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/20 p-4">
            <div className="flex gap-2 print:hidden">
              <Button onClick={handlePrint} size="sm" variant="outline" className="gap-1.5">
                <Printer className="h-4 w-4" /> طباعة
              </Button>
              <Button onClick={handleShare} size="sm" className="gap-1.5">
                <Share2 className="h-4 w-4" /> مشاركة
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {byYear.map(([y, c]) => (
                <span
                  key={y}
                  className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800"
                >
                  {y}هـ: {c}
                </span>
              ))}
            </div>
          </Card>
        )}

        <Card className="border-primary/20 p-4">
          <div className="relative">
            <SearchIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن طالب/ة..."
              className="rounded-xl pr-9"
            />
          </div>
        </Card>

        <Card className="overflow-x-auto border-primary/20 p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> جارِ التحميل...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              {query ? "لا توجد نتائج مطابقة" : "لا يوجد خاتمون مسجّلون بعد"}
            </div>
          ) : (
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="border border-border p-2">م</th>
                  <th className="border border-border p-2">الاسم</th>
                  <th className="border border-border p-2">المعلم/ة</th>
                  <th className="border border-border p-2">عام الختم</th>
                  <th className="border border-border p-2">المجموع</th>
                  <th className="border border-border p-2">التقدير</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={`${e.studentId}-${e.year}`} className="odd:bg-secondary/20">
                    <td className="border border-border p-2 text-center">{i + 1}</td>
                    <td className="border border-border p-2 font-bold">{e.name}</td>
                    <td className="border border-border p-2 text-muted-foreground">
                      {e.teacher || "-"}
                    </td>
                    <td className="border border-border p-2 text-center font-bold text-islamic-green">
                      {e.year}هـ
                    </td>
                    <td className="border border-border p-2 text-center">{e.totalScore || "-"}</td>
                    <td className="border border-border p-2 text-center">{e.grade || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Khatimat;
