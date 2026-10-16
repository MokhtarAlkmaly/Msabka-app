import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Search as SearchIcon,
  Printer,
  FileSpreadsheet,
  Share2,
  Save,
  Home,
  Loader2,
  TrendingUp,
  TrendingDown,
  Trophy,
  Gift,
  Award as AwardIcon,
} from "lucide-react";
import { loadXLSX, saveWorkbook } from "@/utils/excel";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { BRAND_PRINT_TITLE } from "@/lib/brand";
import { Student, HifzHistory, YearData, START_YEAR, END_YEAR } from "@/types/student";
import {
  loadGlobalStudents,
  loadHifzHistory,
  saveHifzHistory,
  loadYearData,
  saveYearData,
  saveStudent,
  loadAwards,
  loadCertificates,
  AwardRow,
  CertificateRow,
} from "@/utils/storage";
import { resolveBaseHifz, calculateGrade, calculatePrize } from "@/utils/calculations";
import { printHtml, esc } from "@/utils/report";

const YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);

interface RowState {
  year: number;
  data: YearData;
}

const emptyYearData = (): YearData => ({
  baseHifz: "0",
  totalHifz: "0",
  parts: "",
  annual: "",
  recitation: "",
  memorization: "",
  total: "0",
  grade: "",
  prize: "0",
  statusPrize: "",
  rank: "-",
  teacher: "",
});

const Search = () => {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);
  const [history, setHistory] = useState<HifzHistory>({});
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signatures, setSignatures] = useState({ teacher: "", supervisor: "", manager: "" });
  const [awards, setAwards] = useState<AwardRow[]>([]);
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);

  useEffect(() => {
    loadGlobalStudents().then(setStudents);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().replace(/\s+/g, " ");
    if (!q) return [];
    return students.filter((s) => (s.name || "").includes(q)).slice(0, 12);
  }, [query, students]);

  const openStudent = async (student: Student) => {
    setLoading(true);
    setSelected(student);
    try {
      const h = await loadHifzHistory(student.id);
      setHistory(h || {});
      const loaded: RowState[] = [];
      for (const year of YEARS) {
        const data = await loadYearData(year.toString(), student.id);
        loaded.push({ year, data: { ...emptyYearData(), ...data } });
      }
      setRows(loaded);

      const name = (student.name || "").trim();
      const matches = (v?: string | null) => (v || "").trim() === name;
      const [allAwards, allCerts] = await Promise.all([loadAwards(), loadCertificates()]);
      setAwards(allAwards.filter((a) => matches(a.recipient_name) || matches(a.student_name)));
      setCertificates(allCerts.filter((c) => matches(c.recipient_name)));
    } finally {
      setLoading(false);
    }
  };

  const computed = (row: RowState) => {
    const baseHifz = resolveBaseHifz(history, row.year, row.data.baseHifz);
    const parts = parseFloat(row.data.parts) || 0;
    const totalHifz = Math.min(baseHifz + parts, 30);
    const annual = parseFloat(row.data.annual) || 0;
    const recitation = parseFloat(row.data.recitation) || 0;
    const memorization = parseFloat(row.data.memorization) || 0;
    const totalScore = Math.min(annual + recitation + memorization, 100);
    const { grade, pricePerPart } = calculateGrade(totalScore);
    const prize = calculatePrize(parts, pricePerPart);
    const statusPrize = parseFloat(row.data.statusPrize) || 0;
    return {
      baseHifz,
      parts,
      totalHifz,
      annual,
      recitation,
      memorization,
      totalScore,
      grade,
      prize,
      statusPrize,
    };
  };

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const c = computed(r);
        acc.parts += c.parts;
        acc.prize += c.prize;
        acc.statusPrize += c.statusPrize;
        return acc;
      },
      { parts: 0, prize: 0, statusPrize: 0 },
    );
  }, [rows, history]);

  // إحصائيات النسب المئوية والتقدم بين الأعوام
  const stats = useMemo(() => {
    const active = rows
      .map((r) => ({ year: r.year, c: computed(r) }))
      .filter((x) => x.c.parts > 0 || x.c.totalScore > 0 || x.c.baseHifz > 0 || x.c.statusPrize > 0)
      .sort((a, b) => a.year - b.year);

    const perYear = active.map((x, i) => {
      const prev = i > 0 ? active[i - 1] : null;
      const scorePct = Math.round(x.c.totalScore);
      const hifzPct = Math.round((x.c.totalHifz / 30) * 100);
      const newHifzPct = Math.round((x.c.parts / 30) * 100);
      const prevScore = prev?.c.totalScore || 0;
      const scoreDelta = prev ? scorePct - Math.round(prevScore) : null;
      const scoreGrowthPct =
        prev && prevScore > 0 ? Math.round(((x.c.totalScore - prevScore) / prevScore) * 100) : null;
      const prevParts = prev?.c.parts || 0;
      const partsDelta = prev ? x.c.parts - prevParts : null;
      const partsGrowthPct =
        prev && prevParts > 0 ? Math.round(((x.c.parts - prevParts) / prevParts) * 100) : null;
      return {
        ...x,
        scorePct,
        hifzPct,
        newHifzPct,
        scoreDelta,
        scoreGrowthPct,
        partsDelta,
        partsGrowthPct,
      };
    });

    const bestByScore = perYear.reduce<(typeof perYear)[number] | null>(
      (best, cur) => (!best || cur.c.totalScore > best.c.totalScore ? cur : best),
      null,
    );
    const bestByParts = perYear.reduce<(typeof perYear)[number] | null>(
      (best, cur) => (!best || cur.c.parts > best.c.parts ? cur : best),
      null,
    );
    const avgScorePct = perYear.length
      ? Math.round(perYear.reduce((s, x) => s + x.c.totalScore, 0) / perYear.length)
      : 0;
    const lastHifzPct = perYear.length ? perYear[perYear.length - 1].hifzPct : 0;

    return {
      perYear,
      bestByScore,
      bestByParts,
      avgScorePct,
      lastHifzPct,
      yearsCount: perYear.length,
    };
  }, [rows, history]);

  const updateRow = (year: number, field: keyof YearData, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.year === year ? { ...r, data: { ...r.data, [field]: value } } : r)),
    );
  };

  const updateHistory = (year: number, value: string) => {
    setHistory((prev) => ({ ...prev, [`h${year}`]: value }));
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await saveStudent({ id: selected.id, name: selected.name, teacher: selected.teacher || "" });
      await saveHifzHistory(selected.id, history);
      for (const row of rows) {
        const c = computed(row);
        await saveYearData(row.year.toString(), selected.id, {
          ...row.data,
          baseHifz: c.baseHifz.toString(),
          totalHifz: c.totalHifz.toString(),
          total: c.totalScore.toString(),
          grade: c.grade,
          prize: c.prize.toString(),
        });
      }
      toast({ title: "تم الحفظ", description: `تم حفظ بيانات ${selected.name} لجميع الأعوام` });
    } catch (e) {
      toast({ title: "خطأ في الحفظ", description: "تعذّر حفظ البيانات", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const activeRows = () =>
    rows.filter((r) => {
      const c = computed(r);
      return c.parts > 0 || c.totalScore > 0 || c.baseHifz > 0 || c.statusPrize > 0;
    });

  // يحدد نطاق الأعوام الفعلي الذي يظهر للطالب/ة بالجدول التفصيلي:
  // يبدأ من أول عام له فيه أي سجل (حفظ جديد/درجات/حفظ سابق مستورد)
  // وينتهي بأول عام يصل فيه إجمالي الحفظ إلى 30 جزءاً (الختم)،
  // أو بآخر عام له فيه سجل إن لم يختم بعد.
  // الأعوام بين البداية والنهاية التي لا يوجد فيها "حفظ جديد" تُعرض كـ"منقطع".
  const visibleRange = useMemo(() => {
    const withData = rows
      .map((r) => ({ row: r, c: computed(r) }))
      .filter(
        (x) => x.c.parts > 0 || x.c.totalScore > 0 || x.c.baseHifz > 0 || x.c.statusPrize > 0,
      );

    if (withData.length === 0)
      return { start: null as number | null, end: null as number | null, completed: false };

    const start = Math.min(...withData.map((x) => x.row.year));
    const completionEntry = withData
      .filter((x) => x.row.year >= start && x.c.totalHifz >= 30)
      .sort((a, b) => a.row.year - b.row.year)[0];

    if (completionEntry) {
      return { start, end: completionEntry.row.year, completed: true };
    }
    const end = Math.max(...withData.map((x) => x.row.year));
    return { start, end, completed: false };
  }, [rows, history]);

  const displayRows = useMemo(() => {
    if (visibleRange.start === null || visibleRange.end === null) return [];
    return rows.filter((r) => r.year >= visibleRange.start! && r.year <= visibleRange.end!);
  }, [rows, visibleRange]);

  const handlePrint = () => {
    if (!selected) return;
    const list = activeRows();
    const body = `
      <div class="head">
        <img src="${logo}" class="logo" />
        <div>
          <h1>${BRAND_PRINT_TITLE}</h1>
          <div class="sub">سجل الطالب/ة الشامل خلال جميع الأعوام</div>
        </div>
      </div>
      <h2>الطالب/ة: ${esc(selected.name)}</h2>
      <table>
        <thead>
          <tr>
            <th>العام</th><th>المعلم/ة</th><th>حفظ سابق</th><th>حفظ جديد</th><th>إجمالي الحفظ</th>
            <th>السنوية</th><th>التلاوة</th><th>الحفظ</th><th>المجموع</th><th>التقدير</th><th>المكافأة</th><th>مكافأة الحالة</th>
          </tr>
        </thead>
        <tbody>
        ${
          list.length === 0
            ? `<tr><td colspan="12" class="empty">لا توجد بيانات</td></tr>`
            : list
                .map((r) => {
                  const c = computed(r);
                  return `<tr>
            <td class="num">${r.year}هـ</td>
            <td>${esc(r.data.teacher || "-")}</td>
            <td class="num">${c.baseHifz || "-"}</td>
            <td class="num">${c.parts || "-"}</td>
            <td class="num">${c.totalHifz >= 30 ? "خاتم" : c.totalHifz || "-"}</td>
            <td class="num">${c.annual || "-"}</td>
            <td class="num">${c.recitation || "-"}</td>
            <td class="num">${c.memorization || "-"}</td>
            <td class="num">${c.totalScore || "-"}</td>
            <td class="num">${esc(c.grade || "-")}</td>
            <td class="num">${c.prize.toLocaleString()}</td>
            <td class="num">${c.statusPrize.toLocaleString()}</td>
          </tr>`;
                })
                .join("")
        }
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3">الإجمالي</td>
            <td class="num">${totals.parts}</td>
            <td colspan="6"></td>
            <td class="num">${totals.prize.toLocaleString()}</td>
            <td class="num">${totals.statusPrize.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
      <h2>إحصائيات التقدم</h2>
      <table>
        <thead>
          <tr><th>العام</th><th>نسبة الدرجة</th><th>نسبة إتمام الحفظ</th><th>نسبة الحفظ الجديد</th><th>تغيّر الدرجة</th><th>تغيّر الحفظ الجديد</th></tr>
        </thead>
        <tbody>
        ${
          stats.perYear.length === 0
            ? `<tr><td colspan="6" class="empty">لا توجد بيانات</td></tr>`
            : stats.perYear
                .map(
                  (x) => `<tr>
            <td class="num">${x.year}هـ</td>
            <td class="num">${x.scorePct}%</td>
            <td class="num">${x.hifzPct}%</td>
            <td class="num">${x.newHifzPct}%</td>
            <td class="num">${x.scoreDelta === null ? "-" : `${x.scoreDelta > 0 ? "+" : ""}${x.scoreDelta}${x.scoreGrowthPct !== null ? ` (${x.scoreGrowthPct > 0 ? "+" : ""}${x.scoreGrowthPct}%)` : ""}`}</td>
            <td class="num">${x.partsDelta === null ? "-" : `${x.partsDelta > 0 ? "+" : ""}${x.partsDelta}${x.partsGrowthPct !== null ? ` (${x.partsGrowthPct > 0 ? "+" : ""}${x.partsGrowthPct}%)` : ""}`}</td>
          </tr>`,
                )
                .join("")
        }
        </tbody>
      </table>
      <p>العام الأفضل بالدرجات: <b>${stats.bestByScore ? `${stats.bestByScore.year}هـ (${stats.bestByScore.scorePct}%)` : "-"}</b> — العام الأفضل بالحفظ الجديد: <b>${stats.bestByParts ? `${stats.bestByParts.year}هـ (${stats.bestByParts.c.parts} جزء)` : "-"}</b> — متوسط الدرجات: <b>${stats.avgScorePct}%</b></p>
      <h2>الجوائز وشهادات التقدير</h2>
      <table>
        <thead><tr><th>النوع</th><th>العام</th><th>البيان</th><th>القيمة</th></tr></thead>
        <tbody>
        ${
          awards.length + certificates.length === 0
            ? `<tr><td colspan="4" class="empty">لا توجد بيانات</td></tr>`
            : [
                ...awards.map(
                  (a) =>
                    `<tr><td>${a.award_kind === "in_kind" ? "جائزة عينية" : "جائزة نقدية"}</td><td class="num">${esc(a.year)}هـ</td><td>${esc(a.item || a.award_type || "")}</td><td class="num">${a.amount ? a.amount.toLocaleString() : "-"}</td></tr>`,
                ),
                ...certificates.map(
                  (c) =>
                    `<tr><td>شهادة تقدير</td><td class="num">${esc(c.year)}هـ</td><td>${esc(c.title || c.cert_type || "")}</td><td class="num">-</td></tr>`,
                ),
              ].join("")
        }
        </tbody>
      </table>
      <div class="signs">
        <div><span>المعلم/ة</span><b>${esc(signatures.teacher)}</b><i>التوقيع: ..................</i></div>
        <div><span>المشرف/ة</span><b>${esc(signatures.supervisor)}</b><i>التوقيع: ..................</i></div>
        <div><span>المديرة</span><b>${esc(signatures.manager)}</b><i>التوقيع: ..................</i></div>
      </div>

    `;
    printHtml(
      `سجل ${selected.name}`,
      body,
      `
      .head{display:flex;align-items:center;gap:14px;justify-content:center;border-bottom:3px double #0e6b3a;padding-bottom:10px}
      .logo{height:70px}
      .signs{display:flex;gap:12px;margin-top:40px}
      .signs>div{flex:1;text-align:center;border-top:1px solid #0e6b3a;padding-top:8px}
      .signs span{display:block;font-size:12px;color:#5b6b62}
      .signs b{display:block;margin:4px 0 10px;font-size:15px}
      .signs i{font-size:12px;color:#666;font-style:normal}
    `,
    );
  };

  const handleExport = async () => {
    if (!selected) return;
    const data = activeRows().map((r) => {
      const c = computed(r);
      return {
        العام: `${r.year}هـ`,
        "المعلم/ة": r.data.teacher || "",
        "حفظ سابق": c.baseHifz,
        "حفظ جديد": c.parts,
        "إجمالي الحفظ": c.totalHifz,
        السنوية: c.annual,
        التلاوة: c.recitation,
        الحفظ: c.memorization,
        المجموع: c.totalScore,
        التقدير: c.grade,
        المكافأة: c.prize,
        "مكافأة الحالة": c.statusPrize,
      };
    });
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = Array(12).fill({ wch: 14 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "سجل الطالب/ة");

    const statsSheet = stats.perYear.map((x) => ({
      العام: `${x.year}هـ`,
      "نسبة الدرجة %": x.scorePct,
      "نسبة إتمام الحفظ %": x.hifzPct,
      "نسبة الحفظ الجديد %": x.newHifzPct,
      "تغيّر الدرجة": x.scoreDelta ?? "",
      "نسبة تغيّر الدرجة %": x.scoreGrowthPct ?? "",
      "تغيّر الحفظ الجديد": x.partsDelta ?? "",
      "نسبة تغيّر الحفظ %": x.partsGrowthPct ?? "",
      "العام الأفضل": stats.bestByScore?.year === x.year ? "نعم" : "",
    }));
    const wsStats = XLSX.utils.json_to_sheet(
      statsSheet.length ? statsSheet : [{ العام: "لا توجد بيانات" }],
    );
    wsStats["!cols"] = Array(9).fill({ wch: 18 });
    XLSX.utils.book_append_sheet(wb, wsStats, "الإحصائيات");

    const extras = [
      ...awards.map((a) => ({
        النوع: a.award_kind === "in_kind" ? "جائزة عينية" : "جائزة نقدية",
        العام: `${a.year}هـ`,
        البيان: a.item || a.award_type || "",
        القيمة: a.amount || "",
      })),
      ...certificates.map((c) => ({
        النوع: "شهادة تقدير",
        العام: `${c.year}هـ`,
        البيان: c.title || c.cert_type || "",
        القيمة: "",
      })),
    ];
    const wsExtras = XLSX.utils.json_to_sheet(
      extras.length ? extras : [{ النوع: "لا توجد بيانات" }],
    );
    wsExtras["!cols"] = Array(4).fill({ wch: 20 });
    XLSX.utils.book_append_sheet(wb, wsExtras, "الجوائز والشهادات");

    const fileName = `سجل_${selected.name}.xlsx`;
    await saveWorkbook(wb, fileName);
    toast({ title: "تم التصدير", description: "تم تصدير سجل الطالب/ة والإحصائيات إلى Excel" });
  };

  const handleWhatsApp = async () => {
    const { shareText } = await import("@/utils/nativePrint");
    if (!selected) return;
    const lines = activeRows().map((r) => {
      const c = computed(r);
      return `${r.year}هـ: حفظ ${c.parts} | مجموع ${c.totalScore} | ${c.grade || "-"} | مكافأة ${c.prize.toLocaleString()}`;
    });
    const statLines = stats.perYear.map(
      (x) =>
        `${x.year}هـ: درجة ${x.scorePct}% | إتمام الحفظ ${x.hifzPct}%${x.scoreDelta !== null ? ` | التغيّر ${x.scoreDelta > 0 ? "+" : ""}${x.scoreDelta}` : ""}`,
    );
    const extraLines = [
      ...awards.map(
        (a) =>
          `جائزة ${a.award_kind === "in_kind" ? "عينية" : "نقدية"} ${a.year}هـ: ${a.item || a.award_type || ""}${a.amount ? ` (${a.amount.toLocaleString()} ريال)` : ""}`,
      ),
      ...certificates.map((c) => `شهادة تقدير ${c.year}هـ: ${c.title || c.cert_type || ""}`),
    ];
    const text = [
      `سجل الطالب/ة: ${selected.name}`,
      ...lines,
      `إجمالي الأجزاء: ${totals.parts}`,
      `إجمالي المكافآت: ${(totals.prize + totals.statusPrize).toLocaleString()} ريال`,
      ...(statLines.length
        ? [
            "",
            "الإحصائيات:",
            ...statLines,
            `متوسط الدرجات: ${stats.avgScorePct}%`,
            `العام الأفضل: ${stats.bestByScore ? `${stats.bestByScore.year}هـ` : "-"}`,
          ]
        : []),
      ...(extraLines.length ? ["", "الجوائز والشهادات:", ...extraLines] : []),
    ].join("\n");
    shareText(text);
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-4">
        <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/20 p-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="شعار المركز" className="h-12 w-12 object-contain" />
            <div>
              <h1 className="text-lg font-bold text-primary">البحث عن طالب/ة</h1>
              <p className="text-xs text-muted-foreground">
                سجل شامل لكل الأعوام قابل للتعديل والطباعة والمشاركة
              </p>
            </div>
          </div>
          <Link to="/">
            <Button variant="outline" size="sm" className="gap-1">
              <Home className="h-4 w-4" />
              الرئيسية
            </Button>
          </Link>
        </Card>

        <Card className="space-y-3 border-primary/20 p-4 print:hidden">
          <div className="relative">
            <SearchIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="اكتب اسم الطالب/ة..."
              className="h-11 rounded-xl pr-9"
            />
          </div>
          {results.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {results.map((s) => (
                <Button
                  key={s.id}
                  variant={selected?.id === s.id ? "default" : "secondary"}
                  className="justify-start rounded-xl"
                  onClick={() => openStudent(s)}
                >
                  {s.name}
                </Button>
              ))}
            </div>
          )}
          {query.trim() && results.length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد نتائج مطابقة</p>
          )}
        </Card>

        {loading && (
          <div className="flex items-center justify-center gap-2 p-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> جارٍ تحميل السجل...
          </div>
        )}

        {selected && !loading && (
          <Card className="space-y-4 border-primary/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
              <h2 className="text-base font-bold text-primary">سجل الطالب/ة: {selected.name}</h2>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1">
                  <Save className="h-4 w-4" />
                  {saving ? "جارٍ الحفظ..." : "حفظ"}
                </Button>
                <Button onClick={handlePrint} size="sm" variant="secondary" className="gap-1">
                  <Printer className="h-4 w-4" /> طباعة
                </Button>
                <Button onClick={handleExport} size="sm" variant="outline" className="gap-1">
                  <FileSpreadsheet className="h-4 w-4" /> تصدير Excel
                </Button>
                <Button onClick={handleWhatsApp} size="sm" variant="outline" className="gap-1">
                  <Share2 className="h-4 w-4" /> واتساب
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-center text-sm">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="border border-border p-2">العام</th>
                    <th className="border border-border p-2">المعلم/ة</th>
                    <th className="border border-border p-2">حفظ العام (سجل)</th>
                    <th className="border border-border p-2">حفظ سابق</th>
                    <th className="border border-border p-2">حفظ جديد</th>
                    <th className="border border-border p-2">إجمالي الحفظ</th>
                    <th className="border border-border p-2">السنوية</th>
                    <th className="border border-border p-2">التلاوة</th>
                    <th className="border border-border p-2">الحفظ</th>
                    <th className="border border-border p-2">المجموع</th>
                    <th className="border border-border p-2">التقدير</th>
                    <th className="border border-border p-2">المكافأة</th>
                    <th className="border border-border p-2">مكافأة الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="border border-border p-4 text-muted-foreground">
                        لا توجد بيانات مسجّلة لهذا الطالب/ة بعد
                      </td>
                    </tr>
                  ) : (
                    displayRows.map((row) => {
                      const c = computed(row);
                      const isDropped = c.parts <= 0 && c.totalHifz < 30;
                      return (
                        <tr
                          key={row.year}
                          className={
                            isDropped
                              ? "bg-destructive/5 odd:bg-destructive/10"
                              : "odd:bg-secondary/20"
                          }
                        >
                          <td className="border border-border p-1 font-bold text-primary">
                            {row.year}هـ
                          </td>
                          <td className="border border-border p-1">
                            <Input
                              value={row.data.teacher || ""}
                              onChange={(e) => updateRow(row.year, "teacher", e.target.value)}
                              className="h-9 min-w-[110px] rounded-lg border-0 bg-background/70 text-center"
                            />
                          </td>
                          <td className="border border-border p-1">
                            <Input
                              value={history[`h${row.year}`] || ""}
                              onChange={(e) => updateHistory(row.year, e.target.value)}
                              type="number"
                              min="0"
                              className="h-9 w-16 rounded-lg border-0 bg-background/70 text-center"
                            />
                          </td>
                          <td className="border border-border bg-accent/20 p-1 font-bold">
                            {c.baseHifz || "-"}
                          </td>
                          <td className="border border-border p-1">
                            {isDropped ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">
                                  منقطع
                                </span>
                                <Input
                                  value={row.data.parts}
                                  onChange={(e) => updateRow(row.year, "parts", e.target.value)}
                                  type="number"
                                  min="0"
                                  placeholder="—"
                                  className="h-8 w-16 rounded-lg border-0 bg-background/70 text-center text-xs"
                                />
                              </div>
                            ) : (
                              <Input
                                value={row.data.parts}
                                onChange={(e) => updateRow(row.year, "parts", e.target.value)}
                                type="number"
                                min="0"
                                className="h-9 w-16 rounded-lg border-0 bg-background/70 text-center"
                              />
                            )}
                          </td>
                          <td className="border border-border p-1 font-bold text-islamic-green">
                            {c.totalHifz >= 30 ? "خاتم ✨" : c.totalHifz || "-"}
                          </td>
                          <td className="border border-border p-1">
                            <Input
                              value={row.data.annual}
                              onChange={(e) => updateRow(row.year, "annual", e.target.value)}
                              type="number"
                              min="0"
                              max="20"
                              className="h-9 w-16 rounded-lg border-0 bg-background/70 text-center"
                            />
                          </td>
                          <td className="border border-border p-1">
                            <Input
                              value={row.data.recitation}
                              onChange={(e) => updateRow(row.year, "recitation", e.target.value)}
                              type="number"
                              min="0"
                              max="20"
                              className="h-9 w-16 rounded-lg border-0 bg-background/70 text-center"
                            />
                          </td>

                          <td className="border border-border p-1">
                            <Input
                              value={row.data.memorization}
                              onChange={(e) => updateRow(row.year, "memorization", e.target.value)}
                              type="number"
                              min="0"
                              max="60"
                              className="h-9 w-16 rounded-lg border-0 bg-background/70 text-center"
                            />
                          </td>
                          <td className="border border-border p-1 font-bold">
                            {c.totalScore || "-"}
                          </td>
                          <td className="border border-border p-1 font-semibold">
                            {c.grade || "-"}
                          </td>
                          <td className="border border-border p-1 font-bold text-islamic-green">
                            {c.prize.toLocaleString()}
                          </td>
                          <td className="border border-border p-1">
                            <Input
                              value={row.data.statusPrize || ""}
                              onChange={(e) => updateRow(row.year, "statusPrize", e.target.value)}
                              type="number"
                              min="0"
                              className="h-9 w-20 rounded-lg border-0 bg-background/70 text-center"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/50 font-bold">
                    <td className="border border-border p-2" colSpan={4}>
                      الإجمالي
                    </td>
                    <td className="border border-border p-2">{totals.parts}</td>
                    <td className="border border-border p-2" colSpan={6}></td>
                    <td className="border border-border p-2">{totals.prize.toLocaleString()}</td>
                    <td className="border border-border p-2">
                      {totals.statusPrize.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* إحصائيات النسب المئوية */}
            <div className="space-y-3 border-t border-primary/20 pt-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
                <TrendingUp className="h-4 w-4" /> إحصائيات التقدم بالنسب المئوية
              </h3>

              {stats.yearsCount === 0 ? (
                <p className="text-sm text-muted-foreground">
                  لا توجد بيانات كافية لحساب الإحصائيات
                </p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="space-y-1 p-3">
                      <p className="text-xs text-muted-foreground">نسبة إتمام الحفظ (آخر عام)</p>
                      <p className="text-xl font-bold text-islamic-green">{stats.lastHifzPct}%</p>
                      <Progress value={stats.lastHifzPct} className="h-2" />
                    </Card>
                    <Card className="space-y-1 p-3">
                      <p className="text-xs text-muted-foreground">متوسط الدرجات</p>
                      <p className="text-xl font-bold text-primary">{stats.avgScorePct}%</p>
                      <Progress value={stats.avgScorePct} className="h-2" />
                    </Card>
                    <Card className="space-y-1 p-3">
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Trophy className="h-3 w-3" /> العام الأفضل (الدرجات)
                      </p>
                      <p className="text-xl font-bold text-islamic-gold">
                        {stats.bestByScore ? `${stats.bestByScore.year}هـ` : "-"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stats.bestByScore
                          ? `${stats.bestByScore.scorePct}% • ${stats.bestByScore.c.grade || "-"}`
                          : ""}
                      </p>
                    </Card>
                    <Card className="space-y-1 p-3">
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Trophy className="h-3 w-3" /> العام الأفضل (الحفظ الجديد)
                      </p>
                      <p className="text-xl font-bold text-islamic-gold">
                        {stats.bestByParts ? `${stats.bestByParts.year}هـ` : "-"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stats.bestByParts
                          ? `${stats.bestByParts.c.parts} جزء (${stats.bestByParts.newHifzPct}% من المصحف)`
                          : ""}
                      </p>
                    </Card>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse text-center text-sm">
                      <thead>
                        <tr className="bg-secondary/60">
                          <th className="border border-border p-2">العام</th>
                          <th className="border border-border p-2">نسبة الدرجة</th>
                          <th className="border border-border p-2">نسبة إتمام الحفظ</th>
                          <th className="border border-border p-2">نسبة الحفظ الجديد</th>
                          <th className="border border-border p-2">تغيّر الدرجة</th>
                          <th className="border border-border p-2">تغيّر الحفظ الجديد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.perYear.map((x) => (
                          <tr key={x.year} className="odd:bg-secondary/20">
                            <td className="border border-border p-2 font-bold text-primary">
                              {x.year}هـ
                              {stats.bestByScore?.year === x.year && (
                                <span className="ms-1 text-islamic-gold">★</span>
                              )}
                            </td>
                            <td className="border border-border p-2">
                              <div className="flex items-center gap-2">
                                <Progress value={x.scorePct} className="h-2 flex-1" />
                                <span className="w-10 font-semibold">{x.scorePct}%</span>
                              </div>
                            </td>
                            <td className="border border-border p-2">
                              <div className="flex items-center gap-2">
                                <Progress value={x.hifzPct} className="h-2 flex-1" />
                                <span className="w-10 font-semibold">{x.hifzPct}%</span>
                              </div>
                            </td>
                            <td className="border border-border p-2">{x.newHifzPct}%</td>
                            <td className="border border-border p-2">
                              {x.scoreDelta === null ? (
                                <span className="text-muted-foreground">-</span>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 font-semibold ${x.scoreDelta >= 0 ? "text-islamic-green" : "text-destructive"}`}
                                >
                                  {x.scoreDelta >= 0 ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3" />
                                  )}
                                  {x.scoreDelta > 0 ? "+" : ""}
                                  {x.scoreDelta}
                                  {x.scoreGrowthPct !== null &&
                                    ` (${x.scoreGrowthPct > 0 ? "+" : ""}${x.scoreGrowthPct}%)`}
                                </span>
                              )}
                            </td>
                            <td className="border border-border p-2">
                              {x.partsDelta === null ? (
                                <span className="text-muted-foreground">-</span>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 font-semibold ${x.partsDelta >= 0 ? "text-islamic-green" : "text-destructive"}`}
                                >
                                  {x.partsDelta >= 0 ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3" />
                                  )}
                                  {x.partsDelta > 0 ? "+" : ""}
                                  {x.partsDelta} جزء
                                  {x.partsGrowthPct !== null &&
                                    ` (${x.partsGrowthPct > 0 ? "+" : ""}${x.partsGrowthPct}%)`}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* الجوائز والشهادات من بقية الصفحات */}
            <div className="grid gap-4 border-t border-primary/20 pt-4 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
                  <Gift className="h-4 w-4" /> الجوائز (نقدية وعينية)
                </h3>
                {awards.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    لا توجد جوائز مسجّلة لهذا الطالب/ة
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {awards.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm"
                      >
                        <div>
                          <p className="font-semibold">{a.item || a.award_type || "جائزة"}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.year}هـ{" "}
                            {a.award_kind
                              ? `• ${a.award_kind === "in_kind" ? "عينية" : a.award_kind === "cash" ? "نقدية" : a.award_kind}`
                              : ""}
                          </p>
                        </div>
                        {a.amount > 0 && (
                          <Badge variant="secondary">{a.amount.toLocaleString()} ريال</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
                  <AwardIcon className="h-4 w-4" /> شهادات التقدير
                </h3>
                {certificates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    لا توجد شهادات مسجّلة لهذا الطالب/ة
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {certificates.map((c) => (
                      <li key={c.id} className="rounded-lg border border-border p-2 text-sm">
                        <p className="font-semibold">{c.title || c.cert_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.year}هـ {c.notes ? `• ${c.notes}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid gap-3 border-t border-primary/20 pt-4 sm:grid-cols-3">
              {(
                [
                  ["teacher", "المعلم/ة"],
                  ["supervisor", "المشرف/ة"],
                  ["manager", "المديرة"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1 text-center">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <Input
                    value={signatures[key]}
                    onChange={(e) => setSignatures((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={`اسم ${label}`}
                    className="h-9 rounded-lg text-center"
                  />
                  <p className="text-xs text-muted-foreground">التوقيع: ..................</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Search;
