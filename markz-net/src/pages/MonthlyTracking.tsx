import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Home,
  Save,
  Loader2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Trophy,
  Send,
  Search as SearchIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { BRAND_PRINT_TITLE } from "@/lib/brand";
import { RecallStudents } from "@/components/RecallStudents";
import {
  Student,
  MonthlyRecord,
  QuranPoint,
  START_YEAR,
  END_YEAR,
  TRACKING_MONTHS,
} from "@/types/student";
import {
  loadAllStudentsWithData,
  loadMonthlyTrackingForMonth,
  saveMonthlyRecord,
  getPreviousMonthEndPoints,
  getMonthlyRankings,
  getActiveYear,
  setActiveYear,
  getLatestTrackedPeriod,
} from "@/utils/storage";
import { getSurahList, getAyahCount, calcPagesBetweenAsync } from "@/utils/quranData";

const emptyPoint = (): QuranPoint => ({ surah: null, ayah: null });
const emptyRecord = (): MonthlyRecord => ({
  memoFrom: emptyPoint(),
  memoTo: emptyPoint(),
  memoHifzScore: "",
  memoRecitationScore: "",
  reviewFrom: emptyPoint(),
  reviewTo: emptyPoint(),
  reviewHifzScore: "",
  reviewRecitationScore: "",
  attendanceScore: "",
  behaviorScore: "",
});

// اختيار سورة/آية (من أو إلى) مستخدم بالقسمين
const QuranPointPicker = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: QuranPoint;
  onChange: (p: QuranPoint) => void;
}) => {
  const ayahCount = value.surah ? getAyahCount(value.surah) : 0;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        <Select
          value={value.surah?.toString() || ""}
          onValueChange={(v) => onChange({ surah: parseInt(v), ayah: null })}
        >
          <SelectTrigger className="h-9 min-w-[130px] rounded-lg border-0 bg-background/70 text-xs">
            <SelectValue placeholder="السورة" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {getSurahList().map((s) => (
              <SelectItem key={s.number} value={s.number.toString()}>
                {s.number}. {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={value.ayah?.toString() || ""}
          onValueChange={(v) => onChange({ ...value, ayah: parseInt(v) })}
          disabled={!value.surah}
        >
          <SelectTrigger className="h-9 w-20 rounded-lg border-0 bg-background/70 text-xs">
            <SelectValue placeholder="آية" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {Array.from({ length: ayahCount }, (_, i) => i + 1).map((a) => (
              <SelectItem key={a} value={a.toString()}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

const MonthlyTracking = () => {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("الكل");
  const [year, setYear] = useState<string>("");
  const [month, setMonth] = useState<number>(1);
  const [records, setRecords] = useState<Record<number, MonthlyRecord>>({});
  const [dirty, setDirty] = useState<Record<number, MonthlyRecord>>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rankings, setRankings] = useState<{
    memoName?: string;
    memoScore?: number;
    reviewName?: string;
    reviewScore?: number;
  }>({});
  const [reportStudent, setReportStudent] = useState<Student | null>(null);
  const [reportNote, setReportNote] = useState("");
  const [memoPagesMap, setMemoPagesMap] = useState<Record<number, number>>({});

  const loadData = useCallback(async () => {
    if (!year) return;
    setLoading(true);
    const [yearStudents, monthData, ranks] = await Promise.all([
      loadAllStudentsWithData(year),
      loadMonthlyTrackingForMonth(year, month),
      getMonthlyRankings(year, month),
    ]);
    setStudents(yearStudents);
    setRecords(monthData);
    setDirty({});

    if (ranks.length > 0) {
      const byId = new Map(yearStudents.map((s) => [s.id, s.name]));
      const bestMemo = [...ranks].sort((a, b) => b.memoScore - a.memoScore)[0];
      const bestReview = [...ranks].sort((a, b) => b.reviewScore - a.reviewScore)[0];
      setRankings({
        memoName: bestMemo?.memoScore ? byId.get(bestMemo.studentId) : undefined,
        memoScore: bestMemo?.memoScore,
        reviewName: bestReview?.reviewScore ? byId.get(bestReview.studentId) : undefined,
        reviewScore: bestReview?.reviewScore,
      });
    } else {
      setRankings({});
    }
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // يبدأ هذا القسم دائماً من العام النشط المحفوظ في الإعدادات، مع الاحتفاظ
  // بآخر شهر مسجل إذا كان داخل العام النشط نفسه.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const activeYear = await getActiveYear();
      const latest = await getLatestTrackedPeriod();
      if (cancelled) return;
      setYear(activeYear);
      if (latest?.year === activeYear) setMonth(latest.month);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const getRecord = (studentId: number): MonthlyRecord =>
    dirty[studentId] || records[studentId] || emptyRecord();

  const updateField = <K extends keyof MonthlyRecord>(
    studentId: number,
    field: K,
    value: MonthlyRecord[K],
  ) => {
    setDirty((prev) => ({ ...prev, [studentId]: { ...getRecord(studentId), [field]: value } }));
  };

  const isDirty = Object.keys(dirty).length > 0;

  // يحسب عدد الأوجه تلقائياً (بالخلفية) لكل طالب/ة مفتوحة حالياً، كلما
  // تغيّرت نقطة "من" أو "إلى" لقسم الحفظ الجديد
  useEffect(() => {
    expanded.forEach((studentId) => {
      const record = getRecord(studentId);
      if (
        record.memoFrom.surah &&
        record.memoTo.surah &&
        record.memoFrom.ayah &&
        record.memoTo.ayah
      ) {
        calcPagesBetweenAsync(
          record.memoFrom.surah,
          record.memoFrom.ayah,
          record.memoTo.surah,
          record.memoTo.ayah,
        ).then((pages) => setMemoPagesMap((prev) => ({ ...prev, [studentId]: pages })));
      } else {
        setMemoPagesMap((prev) => ({ ...prev, [studentId]: 0 }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, dirty, records]);

  const toggleExpand = async (studentId: number) => {
    const next = new Set(expanded);
    if (next.has(studentId)) {
      next.delete(studentId);
      setExpanded(next);
      return;
    }
    next.add(studentId);
    setExpanded(next);

    // تعبئة تلقائية لنقطة البداية من نهاية الشهر السابق: تحصل كل ما كانت
    // خانتا "من" (حفظ ومراجعة) فارغتين لهذا الشهر بعد — بغض النظر عن وجود
    // بيانات أخرى محفوظة له (مثل مواظبة/سلوك أُدخلت قبل قسم الحفظ)
    const current = getRecord(studentId);
    if (!current.memoFrom.surah && !current.reviewFrom.surah) {
      const prev = await getPreviousMonthEndPoints(year, studentId, month);
      if (prev.memoFrom.surah || prev.reviewFrom.surah) {
        setDirty((d) => ({
          ...d,
          [studentId]: {
            ...getRecord(studentId),
            memoFrom: prev.memoFrom.surah ? prev.memoFrom : emptyPoint(),
            reviewFrom: prev.reviewFrom.surah ? prev.reviewFrom : emptyPoint(),
          },
        }));
      }
    }
  };

  const handleSaveAll = async () => {
    if (!isDirty) return;
    setSaving(true);
    const entries = Object.entries(dirty);
    let successCount = 0;
    for (const [studentIdStr, record] of entries) {
      const ok = await saveMonthlyRecord(year, parseInt(studentIdStr), month, record);
      if (ok) successCount++;
    }
    setSaving(false);

    if (successCount === entries.length) {
      toast({
        title: "تم الحفظ بنجاح",
        description: `تم حفظ متابعة ${successCount} طالب/ة، وتحديث النتيجة السنوية تلقائياً`,
      });
      await loadData();
    } else {
      toast({
        title: "تعذّر حفظ بعض السجلات",
        description: "تأكد من اتصالك بالإنترنت وحاول مرة أخرى",
        variant: "destructive",
      });
    }
  };

  const monthLabel = TRACKING_MONTHS.find((m) => m.value === month)?.label || "";

  // قائمة المعلمين والمعلمات (فريدة، مرتبة أبجدياً) لتصفية الطلاب حسب المعلم/ة
  const teacherOptions = useMemo(() => {
    const names = Array.from(new Set(students.map((s) => s.teacher).filter((t) => t && t.trim())));
    return names.sort((a, b) => a.localeCompare(b, "ar"));
  }, [students]);

  // الطلاب المعروضون: مصفّون حسب المعلم/ة المختار، ومرتبة أبجدياً بالاسم
  const visibleStudents = useMemo(() => {
    const filtered =
      selectedTeacher === "الكل" ? students : students.filter((s) => s.teacher === selectedTeacher);
    return [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
  }, [students, selectedTeacher]);

  const openReport = (student: Student) => {
    setReportStudent(student);
    setReportNote("");
  };

  const sendReport = async () => {
    if (!reportStudent) return;
    const record = getRecord(reportStudent.id);
    const memoPages =
      record.memoFrom.surah && record.memoTo.surah
        ? await calcPagesBetweenAsync(
            record.memoFrom.surah!,
            record.memoFrom.ayah!,
            record.memoTo.surah!,
            record.memoTo.ayah!,
          )
        : 0;
    const surahName = (n: number | null) => getSurahList().find((s) => s.number === n)?.name || "";
    const point = (p: QuranPoint) => (p.surah ? `${surahName(p.surah)} : ${p.ayah}` : "—");

    const total =
      (parseFloat(record.memoHifzScore) || 0) +
      (parseFloat(record.memoRecitationScore) || 0) +
      (parseFloat(record.reviewHifzScore) || 0) +
      (parseFloat(record.reviewRecitationScore) || 0) +
      (parseFloat(record.attendanceScore) || 0) +
      (parseFloat(record.behaviorScore) || 0);

    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>تقرير شهري - ${reportStudent.name}</title>
      <style>
        body{font-family:Tahoma,Arial,sans-serif;padding:22px;color:#1a3a2a}
        .header{text-align:center;border-bottom:3px solid #2d7a52;padding-bottom:10px;margin-bottom:14px}
        .header img{height:70px}
        .header h1{font-size:19px;color:#2d7a52;margin:6px 0 2px}
        .header h2{font-size:14px;color:#555}
        .info{display:flex;justify-content:space-between;background:#f0f7f3;padding:8px 12px;border-radius:8px;margin-bottom:14px;font-size:13px}
        h3{color:#2d7a52;border-bottom:1px solid #cde3d5;padding-bottom:4px;font-size:15px;margin-top:16px}
        table{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}
        td,th{border:1px solid #ccc;padding:6px 8px;text-align:center}
        th{background:#2d7a52;color:#fff}
        .total{margin-top:14px;text-align:center;font-size:16px;font-weight:bold;color:#2d7a52}
        .note{margin-top:16px;background:#fffaf0;border:1px solid #f0dca0;border-radius:8px;padding:10px;min-height:70px;font-size:13px}
        .note-title{font-weight:bold;color:#8a6d1a;margin-bottom:6px}
        .signatures{display:flex;justify-content:space-between;margin-top:36px}
        .sig{width:45%;text-align:center;font-size:13px}
        .sig .line{border-top:1px solid #444;margin-top:36px;padding-top:4px}
        .footer{text-align:center;margin-top:20px;font-size:11px;color:#888}
        @media print{@page{size:A4;margin:12mm}}
      </style></head><body>
        <div class="header">
          <img src="${logo}" alt="الشعار" />
          <h1>${BRAND_PRINT_TITLE}</h1>
          <h2>التقرير الشهري لمتابعة الطالب/ة</h2>
        </div>
        <div class="info">
          <span><strong>الطالب/ة:</strong> ${reportStudent.name}</span>
          <span><strong>المعلم/ة:</strong> ${reportStudent.teacher || "-"}</span>
          <span><strong>الشهر:</strong> ${monthLabel} ${year}هـ</span>
        </div>

        <h3>قسم الحفظ الجديد</h3>
        <table>
          <tr><th>من</th><th>إلى</th><th>عدد الأوجه</th><th>تسميع الحفظ (25)</th><th>تلاوة الحفظ (15)</th></tr>
          <tr>
            <td>${point(record.memoFrom)}</td>
            <td>${point(record.memoTo)}</td>
            <td>${memoPages || "-"}</td>
            <td>${record.memoHifzScore || "-"}</td>
            <td>${record.memoRecitationScore || "-"}</td>
          </tr>
        </table>

        <h3>قسم المراجعة</h3>
        <table>
          <tr><th>من</th><th>إلى</th><th>تسميع المراجعة (25)</th><th>تلاوة المراجعة (15)</th></tr>
          <tr>
            <td>${point(record.reviewFrom)}</td>
            <td>${point(record.reviewTo)}</td>
            <td>${record.reviewHifzScore || "-"}</td>
            <td>${record.reviewRecitationScore || "-"}</td>
          </tr>
        </table>

        <h3>المواظبة والسلوك</h3>
        <table>
          <tr><th>المواظبة (10)</th><th>السلوك (10)</th></tr>
          <tr><td>${record.attendanceScore || "-"}</td><td>${record.behaviorScore || "-"}</td></tr>
        </table>

        <div class="total">المجموع الكلي هذا الشهر: ${total.toFixed(1)} من 100</div>

        ${reportNote ? `<div class="note"><div class="note-title">رسالة من المعلم/ة لولي الأمر:</div>${reportNote.replace(/\n/g, "<br/>")}</div>` : ""}

        <div class="signatures">
          <div class="sig">توقيع المعلم/ة<div class="line">.......................</div></div>
          <div class="sig">توقيع المشرف/ة<div class="line">.......................</div></div>
        </div>

        <div class="footer">${new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}</div>
      </body></html>`;

    const { printHtmlDocument } = await import("@/utils/nativePrint");
    await printHtmlDocument(html, `تقرير_${reportStudent.name}_${monthLabel}`);
    setReportStudent(null);
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-4">
        <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/20 p-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="شعار المركز" className="h-12 w-12 object-contain" />
            <div>
              <h1 className="text-lg font-bold text-primary">المتابعة الشهرية</h1>
              <p className="text-xs text-muted-foreground">
                الحفظ الجديد والمراجعة شهرياً — تتحدث النتيجة السنوية بالجدول الرئيسي تلقائياً
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/monthly-search">
              <Button variant="outline" size="sm" className="gap-1">
                <SearchIcon className="h-4 w-4" /> بحث المتابعة
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" size="sm" className="gap-1">
                <Home className="h-4 w-4" /> الرئيسية
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="flex flex-wrap items-center gap-3 border-primary/20 p-4">
          <div className="flex items-center gap-2 rounded-2xl bg-primary/10 px-3 py-2 text-sm text-primary ring-1 ring-primary/10">
            <CalendarDays className="h-4 w-4" />
            <span className="font-semibold">العام</span>
            <Select
              value={year}
              onValueChange={(value) => {
                setYear(value);
                void setActiveYear(value);
              }}
            >
              <SelectTrigger className="h-9 w-24 rounded-xl border-primary/20 bg-background font-bold">
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

          <RecallStudents
            targetYear={year}
            onRecalled={loadData}
            buttonClassName="h-9 gap-1.5 rounded-2xl text-xs font-bold"
          />

          <div className="flex items-center gap-2 rounded-2xl bg-secondary px-3 py-2 text-sm ring-1 ring-primary/10">
            <span className="font-semibold">الشهر</span>
            <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
              <SelectTrigger className="h-9 w-32 rounded-xl border-primary/20 bg-background font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRACKING_MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-sm ring-1 ring-primary/10">
            <span className="font-semibold text-emerald-800">المعلم/ة</span>
            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
              <SelectTrigger className="h-9 w-36 rounded-xl border-primary/20 bg-background font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="الكل">كل المعلمين والمعلمات</SelectItem>
                {teacherOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSaveAll}
            disabled={!isDirty || saving}
            className="mr-auto gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ متابعة {monthLabel}
          </Button>
        </Card>

        {(rankings.memoName || rankings.reviewName) && (
          <Card className="flex flex-wrap gap-3 border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
              <Trophy className="h-4 w-4" /> إنجازات شهر {monthLabel}:
            </div>
            {rankings.memoName && (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-300">
                أفضل حفظ: {rankings.memoName} ({rankings.memoScore}/40)
              </span>
            )}
            {rankings.reviewName && (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-300">
                أفضل مراجعة: {rankings.reviewName} ({rankings.reviewScore}/40)
              </span>
            )}
          </Card>
        )}

        <div className="space-y-2">
          {loading ? (
            <Card className="flex items-center justify-center gap-2 border-primary/20 p-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> جارِ التحميل...
            </Card>
          ) : visibleStudents.length === 0 ? (
            <Card className="border-primary/20 p-10 text-center text-muted-foreground">
              {selectedTeacher === "الكل"
                ? `لا يوجد طلاب مسجّلون بعام ${year}هـ (سجّلهم أولاً بالجدول الرئيسي)`
                : `لا يوجد طلاب لدى المعلم/ة ${selectedTeacher} بعام ${year}هـ`}
            </Card>
          ) : (
            visibleStudents.map((student) => {
              const record = getRecord(student.id);
              const isOpen = expanded.has(student.id);
              const rowDirty = !!dirty[student.id];
              const memoPages = memoPagesMap[student.id] || 0;
              return (
                <Card
                  key={student.id}
                  className={`border-primary/20 ${rowDirty ? "ring-2 ring-amber-400" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(student.id)}
                    className="flex w-full items-center justify-between gap-2 p-3 text-right"
                  >
                    <div>
                      <div className="font-bold">{student.name || "بدون اسم"}</div>
                      <div className="text-xs text-muted-foreground">{student.teacher || "-"}</div>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="space-y-4 border-t border-border p-4">
                      <div>
                        <h3 className="mb-2 text-sm font-bold text-primary">قسم الحفظ الجديد</h3>
                        <div className="flex flex-wrap items-end gap-3">
                          <QuranPointPicker
                            label="من"
                            value={record.memoFrom}
                            onChange={(p) => updateField(student.id, "memoFrom", p)}
                          />
                          <QuranPointPicker
                            label="إلى"
                            value={record.memoTo}
                            onChange={(p) => updateField(student.id, "memoTo", p)}
                          />
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-muted-foreground">
                              تسميع الحفظ (25)
                            </span>
                            <Input
                              type="number"
                              min="0"
                              max="25"
                              value={record.memoHifzScore}
                              onChange={(e) =>
                                updateField(student.id, "memoHifzScore", e.target.value)
                              }
                              className="h-9 w-20 rounded-lg border-0 bg-background/70 text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-muted-foreground">
                              تلاوة الحفظ (15)
                            </span>
                            <Input
                              type="number"
                              min="0"
                              max="15"
                              value={record.memoRecitationScore}
                              onChange={(e) =>
                                updateField(student.id, "memoRecitationScore", e.target.value)
                              }
                              className="h-9 w-20 rounded-lg border-0 bg-background/70 text-center"
                            />
                          </div>
                          {memoPages > 0 && (
                            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                              {memoPages} وجه ({(memoPages / 20).toFixed(2)} جزء)
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="mb-2 text-sm font-bold text-primary">قسم المراجعة</h3>
                        <div className="flex flex-wrap items-end gap-3">
                          <QuranPointPicker
                            label="من"
                            value={record.reviewFrom}
                            onChange={(p) => updateField(student.id, "reviewFrom", p)}
                          />
                          <QuranPointPicker
                            label="إلى"
                            value={record.reviewTo}
                            onChange={(p) => updateField(student.id, "reviewTo", p)}
                          />
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-muted-foreground">
                              تسميع المراجعة (25)
                            </span>
                            <Input
                              type="number"
                              min="0"
                              max="25"
                              value={record.reviewHifzScore}
                              onChange={(e) =>
                                updateField(student.id, "reviewHifzScore", e.target.value)
                              }
                              className="h-9 w-20 rounded-lg border-0 bg-background/70 text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-muted-foreground">
                              تلاوة المراجعة (15)
                            </span>
                            <Input
                              type="number"
                              min="0"
                              max="15"
                              value={record.reviewRecitationScore}
                              onChange={(e) =>
                                updateField(student.id, "reviewRecitationScore", e.target.value)
                              }
                              className="h-9 w-20 rounded-lg border-0 bg-background/70 text-center"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-end gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-muted-foreground">
                            المواظبة (10)
                          </span>
                          <Input
                            type="number"
                            min="0"
                            max="10"
                            value={record.attendanceScore}
                            onChange={(e) =>
                              updateField(student.id, "attendanceScore", e.target.value)
                            }
                            className="h-9 w-20 rounded-lg border-0 bg-background/70 text-center"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-muted-foreground">
                            السلوك (10)
                          </span>
                          <Input
                            type="number"
                            min="0"
                            max="10"
                            value={record.behaviorScore}
                            onChange={(e) =>
                              updateField(student.id, "behaviorScore", e.target.value)
                            }
                            className="h-9 w-20 rounded-lg border-0 bg-background/70 text-center"
                          />
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-auto gap-1"
                          onClick={() => openReport(student)}
                        >
                          <Send className="h-4 w-4" /> إرسال تقرير الشهر لولي الأمر
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>

        <p className="px-1 text-xs text-muted-foreground">
          ملاحظة: يُحسب عدد الأوجه تلقائياً حسب مصحف المدينة عند اختيار السورة والآية. المجموع
          الشهري الكامل من 100 (تسميع حفظ 25 + تلاوة حفظ 15 + تسميع مراجعة 25 + تلاوة مراجعة 15 +
          مواظبة 10 + سلوك 10). "حفظ جديد" و"السنوية" بالجدول الرئيسي لعام {year}هـ يُحدَّثان
          تلقائياً من هذي البيانات، وتبقى قابلة للتعديل اليدوي لاحقاً.
        </p>
      </div>

      <Dialog open={!!reportStudent} onOpenChange={(open) => !open && setReportStudent(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              إرسال تقرير شهر {monthLabel} — {reportStudent?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted-foreground">
              رسالة من المعلم/ة لولي الأمر (اختياري)
            </label>
            <Textarea
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
              placeholder="مثال: بارك الله في ابنتكم، مستواها ممتاز هذا الشهر بارك الله فيها..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportStudent(null)}>
              إلغاء
            </Button>
            <Button onClick={sendReport} className="gap-1">
              <Send className="h-4 w-4" /> إنشاء ومشاركة التقرير
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MonthlyTracking;
