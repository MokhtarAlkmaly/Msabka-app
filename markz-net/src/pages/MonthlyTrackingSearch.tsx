import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search as SearchIcon,
  Home,
  Loader2,
  Printer,
  Share2,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  Student,
  START_YEAR,
  END_YEAR,
  TRACKING_MONTHS,
  MonthlyRecord,
  QuranPoint,
} from "@/types/student";
import {
  loadGlobalStudents,
  loadMonthlyTrackingForStudent,
  getActiveYear,
  setActiveYear,
} from "@/utils/storage";
import { getSurahList, calcPagesBetweenAsync } from "@/utils/quranData";
import { printHtml, esc } from "@/utils/report";
import logo from "@/assets/logo.png";
import { BRAND_PRINT_TITLE } from "@/lib/brand";

interface MonthRow {
  month: number;
  label: string;
  record: MonthlyRecord;
  memoScore: number; // من 40
  reviewScore: number; // من 40
  total: number; // من 100
  memoPages: number;
}

const surahName = (n: number | null) => getSurahList().find((s) => s.number === n)?.name || "";
const pointLabel = (p: QuranPoint) => (p.surah ? `${surahName(p.surah)}:${p.ayah}` : "—");

const MonthlyTrackingSearch = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);
  const [year, setYear] = useState<string>("");
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadGlobalStudents().then(setStudents);
    void getActiveYear().then(setYear);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().replace(/\s+/g, " ");
    if (!q) return [];
    return students.filter((s) => (s.name || "").includes(q)).slice(0, 12);
  }, [query, students]);

  const openStudent = async (student: Student, y = year) => {
    setLoading(true);
    setSelected(student);
    setQuery("");
    try {
      const data = await loadMonthlyTrackingForStudent(y, student.id);
      const built: MonthRow[] = await Promise.all(
        TRACKING_MONTHS.map(async (m) => {
          const record = data[m.value] || {
            memoFrom: { surah: null, ayah: null },
            memoTo: { surah: null, ayah: null },
            memoHifzScore: "",
            memoRecitationScore: "",
            reviewFrom: { surah: null, ayah: null },
            reviewTo: { surah: null, ayah: null },
            reviewHifzScore: "",
            reviewRecitationScore: "",
            attendanceScore: "",
            behaviorScore: "",
          };
          const memoScore =
            (parseFloat(record.memoHifzScore) || 0) + (parseFloat(record.memoRecitationScore) || 0);
          const reviewScore =
            (parseFloat(record.reviewHifzScore) || 0) +
            (parseFloat(record.reviewRecitationScore) || 0);
          const total =
            memoScore +
            reviewScore +
            (parseFloat(record.attendanceScore) || 0) +
            (parseFloat(record.behaviorScore) || 0);
          const memoPages =
            record.memoFrom.surah && record.memoTo.surah
              ? await calcPagesBetweenAsync(
                  record.memoFrom.surah,
                  record.memoFrom.ayah!,
                  record.memoTo.surah,
                  record.memoTo.ayah!,
                )
              : 0;
          return {
            month: m.value,
            label: m.label,
            record,
            memoScore,
            reviewScore,
            total,
            memoPages,
          };
        }),
      );
      setRows(built);
    } finally {
      setLoading(false);
    }
  };

  const handleYearChange = (y: string) => {
    setYear(y);
    void setActiveYear(y);
    if (selected) openStudent(selected, y);
  };

  // الأشهر اللي فيها أي بيانات فعلية (نتجاهل الأشهر الفارغة تماماً بالعرض والمقارنة)
  const activeRows = useMemo(() => rows.filter((r) => r.total > 0 || r.memoPages > 0), [rows]);

  // نسبة التغيّر بين كل شهر والشهر النشط اللي قبله (للحفظ وللمراجعة كل على حدة)
  const withDelta = useMemo(() => {
    return activeRows.map((r, i) => {
      const prev = i > 0 ? activeRows[i - 1] : null;
      const memoDelta =
        prev && prev.memoScore > 0
          ? Math.round(((r.memoScore - prev.memoScore) / prev.memoScore) * 100)
          : null;
      const reviewDelta =
        prev && prev.reviewScore > 0
          ? Math.round(((r.reviewScore - prev.reviewScore) / prev.reviewScore) * 100)
          : null;
      return { ...r, memoDelta, reviewDelta };
    });
  }, [activeRows]);

  const avgMemoPct = activeRows.length
    ? Math.round((activeRows.reduce((s, r) => s + r.memoScore, 0) / (activeRows.length * 40)) * 100)
    : 0;
  const avgReviewPct = activeRows.length
    ? Math.round(
        (activeRows.reduce((s, r) => s + r.reviewScore, 0) / (activeRows.length * 40)) * 100,
      )
    : 0;
  const totalPagesAllMonths = activeRows.reduce((s, r) => s + r.memoPages, 0);

  const trendIcon = (delta: number | null) => {
    if (delta === null) return null;
    if (delta > 0) return <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />;
    if (delta < 0) return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const buildReportBody = () => {
    const monthRows = withDelta
      .map(
        (r) => `
      <tr>
        <td>${esc(r.label)}</td>
        <td>${esc(pointLabel(r.record.memoFrom))} ← ${esc(pointLabel(r.record.memoTo))}</td>
        <td class="num">${r.memoPages || "-"}</td>
        <td class="num">${r.memoScore}/40 ${r.memoDelta !== null ? `(${r.memoDelta > 0 ? "+" : ""}${r.memoDelta}%)` : ""}</td>
        <td>${esc(pointLabel(r.record.reviewFrom))} ← ${esc(pointLabel(r.record.reviewTo))}</td>
        <td class="num">${r.reviewScore}/40 ${r.reviewDelta !== null ? `(${r.reviewDelta > 0 ? "+" : ""}${r.reviewDelta}%)` : ""}</td>
        <td class="num">${r.record.attendanceScore || "-"}/10</td>
        <td class="num">${r.record.behaviorScore || "-"}/10</td>
        <td class="num"><b>${r.total}/100</b></td>
      </tr>`,
      )
      .join("");

    return `
      <div class="head">
        <img src="${logo}" class="logo" />
        <div>
          <h1>${BRAND_PRINT_TITLE}</h1>
          <div class="sub">سجل المتابعة الشهرية الشامل خلال عام ${year}هـ</div>
        </div>
      </div>
      <h2>الطالب/ة: ${esc(selected?.name || "")}</h2>
      <div class="cards">
        <div class="card"><span>متوسط مستوى الحفظ</span><b>${avgMemoPct}%</b></div>
        <div class="card"><span>متوسط مستوى المراجعة</span><b>${avgReviewPct}%</b></div>
        <div class="card"><span>إجمالي الأوجه المحفوظة</span><b>${totalPagesAllMonths} وجه</b></div>
        <div class="card"><span>عدد الأشهر النشطة</span><b>${activeRows.length}</b></div>
      </div>
      <table>
        <thead><tr>
          <th>الشهر</th><th>الحفظ (من ← إلى)</th><th>أوجه</th><th>درجة الحفظ</th>
          <th>المراجعة (من ← إلى)</th><th>درجة المراجعة</th><th>مواظبة</th><th>سلوك</th><th>المجموع</th>
        </tr></thead>
        <tbody>${monthRows || '<tr><td colspan="9" class="empty">لا توجد بيانات متابعة مسجّلة لهذا العام</td></tr>'}</tbody>
      </table>
      <div class="thanks">بارك الله في الطالب/ة وثبّته على حفظ كتابه الكريم</div>
    `;
  };

  const handlePrint = () => {
    if (!selected) return;
    printHtml(`متابعة شهرية - ${selected.name}`, buildReportBody());
  };

  const handleShare = async () => {
    if (!selected) return;
    const { printHtmlDocument } = await import("@/utils/nativePrint");
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>متابعة ${esc(selected.name)}</title>
      <style>
        body{font-family:Tahoma,Arial,sans-serif;padding:20px;color:#222}
        h1{text-align:center;color:#0e6b3a}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}
        th,td{border:1px solid #999;padding:5px;text-align:center}
        th{background:#0e6b3a;color:#fff}
      </style></head><body>${buildReportBody()}</body></html>`;
    await printHtmlDocument(html, `متابعة_شهرية_${selected.name}_${year}`);
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-4">
        <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/20 p-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="شعار المركز" className="h-12 w-12 object-contain" />
            <div>
              <h1 className="text-lg font-bold text-primary">بحث المتابعة الشهرية</h1>
              <p className="text-xs text-muted-foreground">
                سجل شامل لكل أشهر العام، بمقارنة نسب التقدم بالحفظ والمراجعة
              </p>
            </div>
          </div>
          <Link to="/monthly">
            <Button variant="outline" size="sm" className="gap-1">
              <Home className="h-4 w-4" /> المتابعة الشهرية
            </Button>
          </Link>
        </Card>

        <Card className="border-primary/20 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <SearchIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="اكتب اسم الطالب/ة..."
                className="rounded-xl pr-9"
              />
              {results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-background shadow-lg">
                  {results.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => openStudent(s)}
                      className="block w-full px-3 py-2 text-right text-sm hover:bg-secondary"
                    >
                      {s.name} <span className="text-xs text-muted-foreground">— {s.teacher}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Select value={year} onValueChange={handleYearChange}>
              <SelectTrigger className="h-10 w-28 rounded-xl border-primary/20 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i).map(
                  (y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}هـ
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {loading ? (
          <Card className="flex items-center justify-center gap-2 border-primary/20 p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> جارِ التحميل...
          </Card>
        ) : selected ? (
          <>
            <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/20 p-4">
              <div>
                <h2 className="text-lg font-bold">{selected.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {selected.teacher} — عام {year}هـ
                </p>
              </div>
              <div className="flex gap-2 print:hidden">
                <Button onClick={handlePrint} size="sm" variant="outline" className="gap-1.5">
                  <Printer className="h-4 w-4" /> طباعة
                </Button>
                <Button onClick={handleShare} size="sm" className="gap-1.5">
                  <Share2 className="h-4 w-4" /> مشاركة
                </Button>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="border-primary/20 p-3 text-center">
                <p className="text-xs text-muted-foreground">متوسط مستوى الحفظ</p>
                <p className="text-2xl font-black text-primary">{avgMemoPct}%</p>
              </Card>
              <Card className="border-primary/20 p-3 text-center">
                <p className="text-xs text-muted-foreground">متوسط مستوى المراجعة</p>
                <p className="text-2xl font-black text-primary">{avgReviewPct}%</p>
              </Card>
              <Card className="border-primary/20 p-3 text-center">
                <p className="text-xs text-muted-foreground">إجمالي الأوجه</p>
                <p className="text-2xl font-black text-primary">{totalPagesAllMonths}</p>
              </Card>
              <Card className="border-primary/20 p-3 text-center">
                <p className="text-xs text-muted-foreground">الأشهر النشطة</p>
                <p className="text-2xl font-black text-primary">{activeRows.length}</p>
              </Card>
            </div>

            <Card className="overflow-x-auto border-primary/20 p-0">
              {withDelta.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">
                  لا توجد بيانات متابعة مسجّلة لهذا العام بعد
                </div>
              ) : (
                <table className="w-full min-w-[820px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-primary text-primary-foreground">
                      <th className="border border-border p-2">الشهر</th>
                      <th className="border border-border p-2">الحفظ (من ← إلى)</th>
                      <th className="border border-border p-2">أوجه</th>
                      <th className="border border-border p-2">درجة الحفظ</th>
                      <th className="border border-border p-2">المراجعة (من ← إلى)</th>
                      <th className="border border-border p-2">درجة المراجعة</th>
                      <th className="border border-border p-2">مواظبة</th>
                      <th className="border border-border p-2">سلوك</th>
                      <th className="border border-border p-2">المجموع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withDelta.map((r) => (
                      <tr key={r.month} className="odd:bg-secondary/20">
                        <td className="border border-border p-2 font-bold text-primary">
                          {r.label}
                        </td>
                        <td className="border border-border p-2 text-xs">
                          {pointLabel(r.record.memoFrom)} ← {pointLabel(r.record.memoTo)}
                        </td>
                        <td className="border border-border p-2 text-center">
                          {r.memoPages || "-"}
                        </td>
                        <td className="border border-border p-2">
                          <div className="flex items-center justify-center gap-1">
                            {r.memoScore}/40 {trendIcon(r.memoDelta)}
                            {r.memoDelta !== null && (
                              <span className="text-xs text-muted-foreground">
                                ({r.memoDelta > 0 ? "+" : ""}
                                {r.memoDelta}%)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="border border-border p-2 text-xs">
                          {pointLabel(r.record.reviewFrom)} ← {pointLabel(r.record.reviewTo)}
                        </td>
                        <td className="border border-border p-2">
                          <div className="flex items-center justify-center gap-1">
                            {r.reviewScore}/40 {trendIcon(r.reviewDelta)}
                            {r.reviewDelta !== null && (
                              <span className="text-xs text-muted-foreground">
                                ({r.reviewDelta > 0 ? "+" : ""}
                                {r.reviewDelta}%)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="border border-border p-2 text-center">
                          {r.record.attendanceScore || "-"}/10
                        </td>
                        <td className="border border-border p-2 text-center">
                          {r.record.behaviorScore || "-"}/10
                        </td>
                        <td className="border border-border p-2 text-center font-bold text-islamic-green">
                          {r.total}/100
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </>
        ) : (
          <Card className="border-primary/20 p-10 text-center text-muted-foreground">
            ابحث عن طالب/ة لعرض متابعتها الشهرية
          </Card>
        )}
      </div>
    </div>
  );
};

export default MonthlyTrackingSearch;
