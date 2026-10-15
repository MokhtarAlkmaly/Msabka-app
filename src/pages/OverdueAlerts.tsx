import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft,
  BellRing,
  CalendarX2,
  ClipboardList,
  Copy,
  GraduationCap,
  HandCoins,
  HeartHandshake,
  Home,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCw,
  Search as SearchIcon,
  TriangleAlert,
  TrendingDown,
  UserPlus,
  UserX,
  Users,
  Wallet,
  WifiOff,
  CircleCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import logo from "@/assets/logo.png";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ALERT_KINDS,
  ALERT_KIND_META,
  SEVERITY_LABEL,
  buildAlertsPrintBody,
  buildOverdueAlerts,
  filterAlerts,
  formatRiyal,
  groupAlerts,
  hijriMonthName,
  isTrackingMonth,
  summarizeAlerts,
  type AlertGroup,
  type AlertKind,
  type AlertSeverity,
  type OverdueAlert,
} from "@/lib/overdue-alerts";
import { HIJRI_MONTHS, YEARS } from "@/components/teachers/shared";
import type { MonthlyRecord, Student } from "@/types/student";
import {
  getActiveYear,
  loadAllStudentsWithData,
  loadCeremonyExpenses,
  loadDonors,
  loadGlobalStudentsWithYears,
  loadMonthlyTrackingForMonth,
  loadTeacherBonuses,
  loadTeachers,
  type CeremonyExpenseRow,
  type DonorRow,
  type TeacherBonusRow,
  type TeacherRow,
} from "@/utils/storage";
import { printHtml } from "@/utils/report";

/** أيقونة كل نوع تنبيه في القائمة. */
const KIND_ICONS: Record<AlertKind, LucideIcon> = {
  "missing-monthly": CalendarX2,
  "incomplete-monthly": ClipboardList,
  "weak-attendance": TrendingDown,
  "missing-teacher": UserX,
  "not-registered-in-year": UserPlus,
  "missing-monthly-bonus": Wallet,
  "outstanding-pledge": HandCoins,
  "incomplete-donor": HeartHandshake,
  "incomplete-expense": ReceiptText,
};

/** أيقونة كل قسم. */
const GROUP_ICONS: Record<AlertGroup, LucideIcon> = {
  students: GraduationCap,
  teachers: Users,
  finance: HeartHandshake,
};

const SEVERITY_CARD: Record<AlertSeverity, string> = {
  high: "border-r-rose-500 bg-rose-50/70 dark:bg-rose-950/30",
  medium: "border-r-amber-500 bg-amber-50/70 dark:bg-amber-950/30",
  low: "border-r-slate-400 bg-slate-50/70 dark:bg-slate-900/40",
};

const SEVERITY_BADGE: Record<AlertSeverity, string> = {
  high: "bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900 dark:text-rose-100",
  medium: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-100",
  low: "bg-slate-200 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100",
};

/** الشهر الهجري الحالي (1-12) — نفس منطق صفحة الإكراميات الشهرية. */
const currentHijriMonth = () => {
  try {
    const formatted = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      month: "numeric",
    }).format(new Date());
    const value = Number(formatted.replace(/[^\d]/g, ""));
    return value >= 1 && value <= 12 ? value : 1;
  } catch {
    return 1;
  }
};

/**
 * صفحة المتأخرات والتنبيهات الذكية: تقارن ما يجب أن يكون محفوظاً (متابعة
 * شهرية لكل طالب مسجّل، إكرامية لكل معلم/ة، تعهّدات الداعمين، بيانات
 * المصروفات) بما هو محفوظ فعلاً، وتعرض الناقص في كشف واحد قابل للطباعة
 * والمشاركة. الصفحة للقراءة فقط ولا تعدّل أي بيانات.
 */
const OverdueAlertsPage = () => {
  const { toast } = useToast();

  const [year, setYear] = useState("");
  const [month, setMonth] = useState(currentHijriMonth);
  const [loading, setLoading] = useState(true);

  const [studentsInYear, setStudentsInYear] = useState<Student[]>([]);
  const [globalStudents, setGlobalStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [bonuses, setBonuses] = useState<TeacherBonusRow[]>([]);
  const [donors, setDonors] = useState<DonorRow[]>([]);
  const [expenses, setExpenses] = useState<CeremonyExpenseRow[]>([]);
  const [monthlyRecords, setMonthlyRecords] = useState<Record<number, MonthlyRecord> | null>(null);
  const [monthlyNote, setMonthlyNote] = useState("");

  const [selectedKinds, setSelectedKinds] = useState<AlertKind[]>([]);
  const [severity, setSeverity] = useState<AlertSeverity | "all">("all");
  const [query, setQuery] = useState("");

  const load = useCallback(
    async (activeYear: string, activeMonth: number) => {
      if (!activeYear) return;
      setLoading(true);
      try {
        const offline = typeof navigator !== "undefined" && navigator.onLine === false;
        const [yearStudents, globalRows, teacherRows, bonusRows, donorRows, expenseRows] =
          await Promise.all([
            loadAllStudentsWithData(activeYear),
            loadGlobalStudentsWithYears(),
            loadTeachers(),
            loadTeacherBonuses(),
            loadDonors(),
            loadCeremonyExpenses(),
          ]);
        setStudentsInYear(yearStudents);
        setGlobalStudents(globalRows);
        setTeachers(teacherRows);
        setBonuses(bonusRows);
        setDonors(donorRows);
        setExpenses(expenseRows);

        // المتابعة الشهرية للطلاب تُقرأ من السحابة: عند انقطاع الاتصال أو
        // خارج موسم المتابعة (شوال ← ذو الحجة) نتجاوز تنبيهاتها بدلاً من
        // إظهار كل الطلاب كمتأخرين.
        if (!isTrackingMonth(activeMonth)) {
          setMonthlyRecords(null);
          setMonthlyNote(
            `المتابعة الشهرية للطلاب تُسجَّل من محرم إلى رمضان، وشهر ${hijriMonthName(activeMonth)} خارج الموسم — لذلك لا تُحتسب متأخرات متابعة لهذا الشهر.`,
          );
        } else if (offline) {
          setMonthlyRecords(null);
          setMonthlyNote(
            "لا يوجد اتصال بالإنترنت، وتعذّر جلب متابعات الشهر من السحابة — تنبيهات المتابعة الشهرية غير معروضة الآن، وبقية التنبيهات تعمل طبيعياً.",
          );
        } else {
          setMonthlyRecords(await loadMonthlyTrackingForMonth(activeYear, activeMonth));
          setMonthlyNote("");
        }
      } catch (error) {
        console.error("تعذّر تحميل بيانات المتأخرات:", error);
        toast({
          title: "تعذر تحميل البيانات",
          description: "تحقق من الاتصال ثم حاول مرة أخرى.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void (async () => {
      const activeYear = await getActiveYear();
      const initialYear = YEARS.includes(activeYear) ? activeYear : YEARS[YEARS.length - 1];
      setYear(initialYear);
      await load(initialYear, month);
    })();
    // يعمل مرة واحدة عند فتح الصفحة، والشهر/العام يُعاد تحميلهما عند تغييرهما.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleYear = (value: string) => {
    setYear(value);
    void load(value, month);
  };

  const handleMonth = (value: string) => {
    const nextMonth = parseInt(value);
    setMonth(nextMonth);
    void load(year, nextMonth);
  };

  const alerts = useMemo(
    () =>
      buildOverdueAlerts({
        year,
        month,
        studentsInYear,
        globalStudents,
        monthlyRecords,
        teacherNames: teachers.map((teacher) => teacher.name),
        bonuses,
        donors,
        expenses,
      }),
    [
      year,
      month,
      studentsInYear,
      globalStudents,
      monthlyRecords,
      teachers,
      bonuses,
      donors,
      expenses,
    ],
  );

  const summary = useMemo(() => summarizeAlerts(alerts), [alerts]);

  const visible = useMemo(
    () => filterAlerts(alerts, { kinds: selectedKinds, severity, query }),
    [alerts, selectedKinds, severity, query],
  );

  const groups = useMemo(() => groupAlerts(visible), [visible]);

  const toggleKind = (kind: AlertKind) =>
    setSelectedKinds((current) =>
      current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind],
    );

  const clearFilters = () => {
    setSelectedKinds([]);
    setSeverity("all");
    setQuery("");
  };

  const monthLabel = hijriMonthName(month);
  const yearLabel = `${(year || "").replace(/D$/, "")}هـ`;

  const handlePrint = () => {
    if (visible.length === 0) {
      toast({
        title: "لا توجد بنود للطباعة",
        description: "لا يوجد متأخرات مطابقة للتصفية الحالية.",
      });
      return;
    }
    void printHtml(
      `كشف المتأخرات — ${monthLabel} ${yearLabel}`,
      buildAlertsPrintBody(visible, {
        year,
        month,
        logoSrc: logo,
        generatedAt: `تاريخ الإصدار: ${new Date().toLocaleDateString("ar-EG")}`,
      }),
    );
  };

  const handleCopy = async () => {
    if (visible.length === 0) {
      toast({ title: "لا توجد بنود للنسخ" });
      return;
    }
    const lines: string[] = [
      `كشف المتأخرات والتنبيهات — شهر ${monthLabel} ${yearLabel}`,
      `الإجمالي: ${summary.total} بند (عالية ${summary.high} · متوسطة ${summary.medium} · منخفضة ${summary.low})`,
    ];
    if (summary.outstandingTotal > 0) {
      lines.push(`المبالغ المتأخرة على الداعمين: ${formatRiyal(summary.outstandingTotal)}`);
    }
    groups.forEach((group) => {
      lines.push("", `— ${group.label} (${group.alerts.length}):`);
      group.alerts.forEach((alert) => {
        const extras = [
          alert.teacher ? `المعلم/ة: ${alert.teacher}` : "",
          alert.amount ? formatRiyal(alert.amount) : "",
        ]
          .filter(Boolean)
          .join(" · ");
        lines.push(`• ${alert.title} — ${alert.detail}${extras ? ` (${extras})` : ""}`);
      });
    });

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({ title: "تم نسخ الكشف", description: "يمكنك لصقه في واتساب أو أي تطبيق آخر." });
    } catch {
      toast({
        title: "تعذّر النسخ",
        description: "المتصفح منع الوصول إلى الحافظة.",
        variant: "destructive",
      });
    }
  };

  const summaryCards = [
    { label: "إجمالي البنود", value: String(summary.total), tone: "text-primary" },
    { label: SEVERITY_LABEL.high, value: String(summary.high), tone: "text-rose-600" },
    { label: SEVERITY_LABEL.medium, value: String(summary.medium), tone: "text-amber-600" },
    { label: SEVERITY_LABEL.low, value: String(summary.low), tone: "text-slate-600" },
    {
      label: "المبالغ المتأخرة",
      value: formatRiyal(summary.outstandingTotal),
      tone: "text-emerald-700",
    },
  ];

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-4">
        <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/20 p-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="شعار المركز" className="h-12 w-12 object-contain" />
            <div>
              <h1 className="flex items-center gap-1.5 text-lg font-bold text-primary">
                <BellRing className="h-4 w-4 text-amber-500" /> المتأخرات والتنبيهات الذكية
              </h1>
              <p className="text-xs text-muted-foreground">
                يرصد تلقائياً ما ينقص: متابعات شهرية، إكراميات، تعهّدات داعمين، وبيانات مصروفات
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => void load(year, month)}
              disabled={loading || !year}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              تحديث
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> طباعة
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => void handleCopy()}
            >
              <Copy className="h-4 w-4" /> نسخ الكشف
            </Button>
            <Link to="/">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Home className="h-4 w-4" /> الرئيسية
              </Button>
            </Link>
          </div>
        </Card>

        {/* اختيار العام والشهر والتصفية */}
        <Card className="space-y-3 p-4 print:hidden">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground">العام</span>
              <Select value={year} onValueChange={handleYear}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="اختر العام" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}هـ
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground">الشهر</span>
              <Select value={String(month)} onValueChange={handleMonth}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HIJRI_MONTHS.map((label, index) => (
                    <SelectItem key={label} value={String(index + 1)}>
                      {index + 1}. {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground">درجة الأهمية</span>
              <Select
                value={severity}
                onValueChange={(value) => setSeverity(value as AlertSeverity | "all")}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الدرجات</SelectItem>
                  <SelectItem value="high">{SEVERITY_LABEL.high}</SelectItem>
                  <SelectItem value="medium">{SEVERITY_LABEL.medium}</SelectItem>
                  <SelectItem value="low">{SEVERITY_LABEL.low}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground">بحث بالاسم</span>
              <div className="relative">
                <SearchIcon className="absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="اسم الطالب/ة أو المعلم/ة أو الداعم"
                  className="h-9 pr-8"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={selectedKinds.length === 0 ? "default" : "outline"}
              onClick={() => setSelectedKinds([])}
            >
              كل الأنواع ({summary.total})
            </Button>
            {ALERT_KINDS.filter((kind) => summary.byKind[kind] > 0).map((kind) => {
              const Icon = KIND_ICONS[kind];
              const active = selectedKinds.includes(kind);
              return (
                <Button
                  key={kind}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => toggleKind(kind)}
                  title={ALERT_KIND_META[kind].hint}
                >
                  <Icon className="ml-1 h-3.5 w-3.5" />
                  {ALERT_KIND_META[kind].label} ({summary.byKind[kind]})
                </Button>
              );
            })}
            {(selectedKinds.length > 0 || severity !== "all" || query.trim()) && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                مسح التصفية
              </Button>
            )}
          </div>
        </Card>

        {/* البطاقات العلوية */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {summaryCards.map((card) => (
            <Card key={card.label} className="border-primary/15 p-3 text-center">
              <div className={cn("text-xl font-black", card.tone)}>{card.value}</div>
              <div className="text-[11px] font-semibold text-muted-foreground">{card.label}</div>
            </Card>
          ))}
        </div>

        {monthlyNote && (
          <Card className="flex items-start gap-2 border-amber-300/60 bg-amber-50/70 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{monthlyNote}</span>
          </Card>
        )}

        {loading ? (
          <Card className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> يجري حساب المتأخرات…
          </Card>
        ) : visible.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <CircleCheck className="h-8 w-8 text-emerald-600" />
            <p className="font-bold">
              {alerts.length === 0
                ? `لا توجد متأخرات — كل شيء مكتمل لشهر ${monthLabel} ${yearLabel}`
                : "لا توجد بنود مطابقة للتصفية الحالية"}
            </p>
            <p className="text-xs text-muted-foreground">
              {alerts.length === 0 ? "بارك الله في جهودكم." : "جرّب توسيع التصفية أو مسح البحث."}
            </p>
          </Card>
        ) : (
          groups.map((group) => {
            const GroupIcon = GROUP_ICONS[group.id];
            return (
              <Card key={group.id} className="space-y-3 border-primary/15 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/10 pb-2">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-primary">
                    <GroupIcon className="h-4 w-4" /> {group.label}
                    <Badge variant="secondary" className="font-bold">
                      {group.alerts.length}
                    </Badge>
                  </h2>
                  <span className="text-[11px] text-muted-foreground">{group.hint}</span>
                </div>

                <div className="space-y-2">
                  {group.alerts.map((alert) => {
                    const Icon = KIND_ICONS[alert.kind];
                    return (
                      <div
                        key={alert.id}
                        className={cn(
                          "flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/60 border-r-4 p-3",
                          SEVERITY_CARD[alert.severity],
                        )}
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold">{alert.title}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {ALERT_KIND_META[alert.kind].label}
                              </Badge>
                              <Badge className={cn("text-[10px]", SEVERITY_BADGE[alert.severity])}>
                                {SEVERITY_LABEL[alert.severity]}
                              </Badge>
                              {alert.amount ? (
                                <span className="text-xs font-black text-emerald-700">
                                  {formatRiyal(alert.amount)}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{alert.detail}</p>
                            {alert.teacher ? (
                              <p className="text-xs text-muted-foreground">
                                المعلم/ة: {alert.teacher}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <Link to={alert.link}>
                          <Button size="sm" variant="outline" className="gap-1">
                            {alert.linkLabel} <ArrowLeft className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })
        )}

        <Card className="flex items-start gap-2 border-primary/15 p-3 text-[11px] text-muted-foreground">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <div>
            <p className="font-semibold">كيف تُحسب هذه التنبيهات؟</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {ALERT_KINDS.map((kind) => (
                <li key={kind}>
                  <span className="font-semibold text-foreground">
                    {ALERT_KIND_META[kind].label}:
                  </span>{" "}
                  {ALERT_KIND_META[kind].hint}
                </li>
              ))}
            </ul>
            <p className="mt-1">
              الصفحة للعرض فقط ولا تعدّل أي بيانات، وكل بند فيه زر ينقلك إلى الصفحة التي يُعالج
              منها.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OverdueAlertsPage;
