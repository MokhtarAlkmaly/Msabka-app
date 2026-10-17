import { printCurrentPage } from "@/utils/nativePrint";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompetitionTable } from "@/components/CompetitionTable";
import { NotificationSystem } from "@/components/notifications/NotificationSystem";
import { InstallPrompt } from "@/components/InstallPrompt";
import { RecallStudents } from "@/components/RecallStudents";
import {
  Printer,
  Settings as SettingsIcon,
  Calendar,
  Save,
  Wifi,
  WifiOff,
  RefreshCw,
  Users,
  Trophy,
  BookOpenCheck,
  WalletCards,
  ArrowRight,
  GraduationCap,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { Student, HifzHistory, YearData, START_YEAR, END_YEAR } from "@/types/student";
import {
  competitionLabelFor,
  competitionYearKey,
  readStoredCompetitionType,
  storeCompetitionType,
  type CompetitionType,
} from "@/lib/competition-year";
import {
  loadAllStudentsWithData,
  loadGlobalStudents,
  saveStudent,
  getActiveYear,
  setActiveYear,
  saveHifzHistory,
  saveYearData,
  migrateYearData,
  syncToCloud,
  syncFromCloud,
  mergeDuplicateStudents,
  loadTeachers as loadCachedTeachers,
  deleteStudentFromYear,
} from "@/utils/storage";
import { getPendingChanges } from "@/utils/localDB";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Progress } from "@/components/ui/progress";

interface DirtyData {
  name: string;
  teacher: string;
  history: HifzHistory;
  yearData: YearData;
}

const Competition = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentYear, setCurrentYear] = useState<string>("1447");
  const [competitionType, setCompetitionType] =
    useState<CompetitionType>(readStoredCompetitionType);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
    label?: string;
  } | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [dirtyMap, setDirtyMap] = useState<Record<number, DirtyData>>({});
  const [teacherNames, setTeacherNames] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  const isDirty = Object.keys(dirtyMap).length > 0;
  const dataYearKey = competitionYearKey(currentYear, competitionType);
  const competitionLabel = competitionLabelFor(competitionType);

  const loadData = useCallback(async () => {
    setLoading(true);
    const studentsWithData = await loadAllStudentsWithData(dataYearKey);
    setStudents(studentsWithData);
    setDirtyMap({});
    setLoading(false);
  }, [dataYearKey]);

  const loadTeachers = useCallback(async () => {
    if (!user) {
      setTeacherNames([]);
      return;
    }
    const data = await loadCachedTeachers(currentYear);
    setTeacherNames(data.map((r) => r.name));
  }, [user, currentYear]);

  useEffect(() => {
    void loadTeachers();
  }, [loadTeachers]);

  const mergedTeacherNames = (() => {
    const set = new Set<string>(teacherNames);
    for (const s of students) {
      const t = (s.teacher || "").trim();
      if (t) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ar"));
  })();

  const autoSyncPending = useCallback(async () => {
    if (!navigator.onLine || !user) return;
    try {
      const pending = await getPendingChanges();
      if (pending.length === 0) return;
      setSyncProgress({ current: 0, total: pending.length + 1, label: "مزامنة العمليات المعلقة" });
      const ok = await syncToCloud((current, total, label) =>
        setSyncProgress({ current, total, label }),
      );
      setSyncProgress(null);
      if (ok) {
        toast({
          title: "تمت المزامنة",
          description: `تم رفع ${pending.length} عملية معلقة إلى السحابة`,
        });
        await loadData();
      }
    } catch (e) {
      setSyncProgress(null);
      console.error("Auto-sync error:", e);
    }
  }, [user, loadData, toast]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void autoSyncPending();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    void autoSyncPending();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [autoSyncPending]);

  useEffect(() => {
    const init = async () => {
      const year = await getActiveYear();
      setCurrentYear(year);
      try {
        const merged = await mergeDuplicateStudents();
        if (merged > 0 && navigator.onLine) {
          await syncToCloud();
        }
      } catch (e) {
        console.error("Auto-merge failed:", e);
      }
    };
    init();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDirtyChange = useCallback((studentId: number, data: DirtyData) => {
    setDirtyMap((prev) => ({ ...prev, [studentId]: data }));
  }, []);

  const handleSaveAll = async () => {
    if (!isDirty) return;

    const norm = (s: string) => (s || "").trim().replace(/\s+/g, " ");
    const nameById = new Map<number, string>();
    for (const s of students) nameById.set(s.id, s.name);
    for (const [idStr, data] of Object.entries(dirtyMap)) {
      nameById.set(parseInt(idStr), data.name);
    }
    const counts: Record<string, number[]> = {};
    for (const [id, n] of nameById) {
      const key = norm(n);
      if (!key) continue;
      (counts[key] = counts[key] || []).push(id);
    }
    const dupNames = Object.entries(counts)
      .filter(([, ids]) => ids.length > 1)
      .map(([k]) => k);
    if (dupNames.length > 0) {
      toast({
        title: "أسماء مكررة",
        description: `يوجد تكرار في: ${dupNames.join("، ")}. الرجاء تعديل الأسماء قبل الحفظ.`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const entries = Object.entries(dirtyMap);
      await Promise.all(
        entries.map(async ([idStr, data]) => {
          const id = parseInt(idStr);
          await saveStudent({ id, name: data.name, teacher: data.teacher });
          await saveHifzHistory(id, data.history);
          await saveYearData(dataYearKey, id, data.yearData);
        }),
      );

      setDirtyMap({});
      setSyncProgress({ current: 0, total: 1, label: "بدء الرفع" });
      const synced = await syncToCloud((current, total, label) =>
        setSyncProgress({ current, total, label }),
      );
      setSyncProgress(null);
      await loadData();

      toast({
        title: "تم الحفظ",
        description: synced
          ? `تم حفظ ومزامنة بيانات ${entries.length} طالب بنجاح`
          : `تم الحفظ محلياً (${entries.length} طالب)`,
      });
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "خطأ في الحفظ",
        description: "حدث خطأ أثناء حفظ البيانات",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleYearChange = async (year: string) => {
    if (isDirty && !confirm("هناك تغييرات غير محفوظة، هل تريد المتابعة بدون حفظ؟")) return;
    const globalStudents = await loadGlobalStudents();
    await migrateYearData(year, globalStudents);
    setCurrentYear(year);
    await setActiveYear(year);
    toast({
      title: "تم تغيير السنة",
      description: `تم التبديل إلى عام ${year}هـ`,
    });
  };

  const handleCompetitionTypeChange = (type: CompetitionType) => {
    if (isDirty && !confirm("هناك تغييرات غير محفوظة، هل تريد المتابعة بدون حفظ؟")) return;
    setCompetitionType(type);
    storeCompetitionType(type);
    toast({
      title: "تم التبديل",
      description:
        type === "dhul_hijjah"
          ? "تم التبديل إلى مسابقة عشر ذي الحجة"
          : "تم التبديل إلى المسابقة الرمضانية",
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا الطالب من المسابقة؟")) return;
    await deleteStudentFromYear(dataYearKey, id);
    setDirtyMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    await loadData();
    toast({
      title: "تم الحذف",
      description: `تم فصل الطالب عن عام ${currentYear}هـ مع إبقائه في السجل العام`,
      variant: "destructive",
    });
  };

  const handlePrint = async () => {
    printCurrentPage(`كشف_${competitionLabel}_${currentYear}`);
  };

  const handleSyncFromCloud = async () => {
    if (!online) {
      toast({
        title: "لا يوجد اتصال",
        description: "يرجى الاتصال بالإنترنت أولاً",
        variant: "destructive",
      });
      return;
    }
    setSyncing(true);
    setSyncProgress({ current: 0, total: 4, label: "بدء التنزيل" });
    const success = await syncFromCloud((current, total, label) =>
      setSyncProgress({ current, total, label }),
    );
    setSyncProgress(null);
    if (success) {
      await loadData();
      toast({ title: "تمت المزامنة", description: "تم تحديث البيانات من السحابة" });
    } else {
      toast({ title: "خطأ", description: "فشل في المزامنة", variant: "destructive" });
    }
    setSyncing(false);
  };

  // Rank calculation
  useEffect(() => {
    const sortedStudents = [...students]
      .filter((s) => parseFloat(s.yearData?.total || "0") > 0)
      .sort((a, b) => parseFloat(b.yearData?.total || "0") - parseFloat(a.yearData?.total || "0"));

    let changed = false;
    for (let i = 0; i < sortedStudents.length; i++) {
      const student = sortedStudents[i];
      const newRank = (i + 1).toString();
      if (student.yearData && student.yearData.rank !== newRank) {
        student.yearData.rank = newRank;
        changed = true;
      }
    }
    if (changed) {
      setStudents((prev) => [...prev]);
    }
  }, [students, dataYearKey]);

  const activeStudents = students.filter((s) => {
    const parts = parseFloat(s.yearData?.parts || "0");
    const total = parseFloat(s.yearData?.total || "0");
    return parts > 0 || total > 0;
  }).length;
  const totalParts = students.reduce(
    (sum, s) => sum + (parseFloat(s.yearData?.parts || "0") || 0),
    0,
  );
  const totalPrizes = students.reduce(
    (sum, s) => sum + (parseFloat(s.yearData?.prize || "0") || 0),
    0,
  );
  const dirtyCount = Object.keys(dirtyMap).length;

  return (
    <div
      className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.16),transparent_34rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)/0.45))]"
      dir="rtl"
    >
      <InstallPrompt />

      {/* Header */}
      <header className="relative isolate px-4 pb-8 pt-4 text-primary-foreground print:bg-primary print:py-4">
        <div className="pointer-events-none absolute inset-x-3 inset-y-3 -z-10 rounded-[2rem] bg-gradient-to-br from-primary via-emerald-700 to-teal-950 shadow-2xl shadow-primary/20 print:rounded-none" />

        <div className="container relative z-10 mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-3xl bg-white/95 p-2 shadow-xl shadow-black/10 ring-1 ring-white/40">
                <img
                  src={logo}
                  alt="مركز إنماء الأهلي الخيري"
                  className="h-16 w-16 object-contain sm:h-20 sm:w-20"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Link to="/">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-white/90 gap-1 rounded-full bg-white/10 hover:bg-white/20"
                    >
                      <GraduationCap className="h-3.5 w-3.5" /> سجل الطلاب الرسمي
                    </Button>
                  </Link>
                  <Link to="/">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-white/90 gap-1 rounded-full bg-white/10 hover:bg-white/20"
                    >
                      <ArrowRight className="h-3.5 w-3.5" /> رجوع
                    </Button>
                  </Link>
                </div>
                <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-4xl">
                  كشف {competitionLabel}
                </h1>
                <p className="mt-1 text-sm text-white/75 sm:text-base">
                  مركز إنماء الأهلي الخيري - قسم القرآن الكريم · الإشراف - شرعب الرونة
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-3xl bg-white/10 p-3 text-sm text-white/85 ring-1 ring-white/15 backdrop-blur sm:min-w-52">
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold">العام: {currentYear}هـ</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${online ? "bg-emerald-300/20 text-emerald-50" : "bg-red-300/20 text-red-50"}`}
                >
                  {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                  {online ? "متصل" : "غير متصل"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 pb-2 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
            <div className="rounded-3xl bg-white/14 p-4 ring-1 ring-white/15 backdrop-blur">
              <Users className="mb-3 h-6 w-6 text-amber-300" />
              <div className="text-3xl font-black">{students.length}</div>
              <div className="text-sm text-white/70">إجمالي طلاب المسابقة</div>
            </div>
            <div className="rounded-3xl bg-white/14 p-4 ring-1 ring-white/15 backdrop-blur">
              <Trophy className="mb-3 h-6 w-6 text-amber-300" />
              <div className="text-3xl font-black">{activeStudents}</div>
              <div className="text-sm text-white/70">طلاب نشطون</div>
            </div>
            <div className="rounded-3xl bg-white/14 p-4 ring-1 ring-white/15 backdrop-blur">
              <BookOpenCheck className="mb-3 h-6 w-6 text-amber-300" />
              <div className="text-3xl font-black">{totalParts.toLocaleString("ar-EG")}</div>
              <div className="text-sm text-white/70">أجزاء محفوظة هذا العام</div>
            </div>
            <div className="rounded-3xl bg-white/14 p-4 ring-1 ring-white/15 backdrop-blur">
              <WalletCards className="mb-3 h-6 w-6 text-amber-300" />
              <div className="text-3xl font-black">{totalPrizes.toLocaleString("ar-EG")}</div>
              <div className="text-sm text-white/70">إجمالي المكافآت</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-7 print:p-0">
        <div className="print:hidden space-y-4">
          <NotificationSystem students={students} currentYear={currentYear} />

          {/* أدوات الاستيراد/التصدير/الحذف انتقلت إلى صفحة الإعدادات */}
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-card/80 px-4 py-3 shadow-lg shadow-primary/5 backdrop-blur">
            <div className="flex items-start gap-2.5">
              <span className="rounded-xl bg-primary/10 p-1.5 text-primary">
                <SettingsIcon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-black text-foreground">
                  الاستيراد والتصدير والحذف في الإعدادات
                </h3>
                <p className="text-xs text-muted-foreground">
                  أدوات ملفات Excel وحذف بيانات المسابقة مجمّعة الآن في صفحة الإعدادات
                </p>
              </div>
            </div>
            <Link to="/settings">
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl">
                <SettingsIcon className="h-3.5 w-3.5" /> فتح الإعدادات
              </Button>
            </Link>
          </section>

          <div className="rounded-[1.75rem] border border-white/70 bg-card/88 p-4 shadow-xl shadow-primary/5 backdrop-blur sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-foreground sm:text-xl">
                  لوحة تحكم المسابقة
                </h2>
                <p className="text-sm text-muted-foreground">
                  إدارة كشوفات عام {currentYear}هـ · {competitionLabel}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 rounded-2xl bg-secondary p-1 ring-1 ring-primary/10">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleCompetitionTypeChange("ramadan")}
                    className={`h-8 rounded-xl px-3 text-xs font-bold ${competitionType === "ramadan" ? "bg-primary text-primary-foreground shadow" : "bg-transparent text-muted-foreground hover:bg-white/60"}`}
                  >
                    المسابقة الرمضانية
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleCompetitionTypeChange("dhul_hijjah")}
                    className={`h-8 rounded-xl px-3 text-xs font-bold ${competitionType === "dhul_hijjah" ? "bg-primary text-primary-foreground shadow" : "bg-transparent text-muted-foreground hover:bg-white/60"}`}
                  >
                    مسابقة عشر ذي الحجة
                  </Button>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-primary/10 px-3 py-2 text-sm text-primary ring-1 ring-primary/10">
                  <Calendar className="h-4 w-4" />
                  <span className="font-semibold">سنة المسابقة</span>
                  <Select value={currentYear} onValueChange={handleYearChange}>
                    <SelectTrigger className="h-9 w-28 rounded-xl border-primary/20 bg-background font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        { length: END_YEAR - START_YEAR + 1 },
                        (_, i) => START_YEAR + i,
                      ).map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}هـ
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <Button
                onClick={handleSaveAll}
                disabled={!isDirty || saving}
                className={`h-12 gap-2 rounded-2xl lg:col-span-2 ${isDirty ? "bg-emerald-600 shadow-lg shadow-emerald-600/25 hover:bg-emerald-700" : ""}`}
              >
                <Save className="h-4 w-4" />
                {saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
                {isDirty && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{dirtyCount}</span>
                )}
              </Button>

              <RecallStudents
                targetYear={dataYearKey}
                onRecalled={loadData}
                buttonClassName="h-12 gap-2 rounded-2xl"
                buttonVariant="secondary"
              />

              <Button onClick={handlePrint} variant="secondary" className="h-12 gap-2 rounded-2xl">
                <Printer className="h-4 w-4" />
                طباعة
              </Button>

              <Button
                onClick={handleSyncFromCloud}
                disabled={syncing || !online}
                variant="outline"
                className="h-12 gap-2 rounded-2xl"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncProgress ? `${syncProgress.current}/${syncProgress.total}` : "مزامنة"}
              </Button>
            </div>

            {syncProgress && (
              <div className="mt-2 space-y-1">
                <Progress
                  value={(syncProgress.current / Math.max(syncProgress.total, 1)) * 100}
                  className="h-2"
                />
                <p className="text-xs text-center text-muted-foreground">
                  {syncProgress.label || "جارٍ المزامنة"}: {syncProgress.current} /{" "}
                  {syncProgress.total}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 pb-8">
          {loading ? (
            <div className="rounded-[1.75rem] border border-white/70 bg-card/80 py-16 text-center text-muted-foreground shadow-xl shadow-primary/5">
              جارٍ تحميل البيانات...
            </div>
          ) : (
            <CompetitionTable
              students={students}
              currentYear={currentYear}
              competitionLabel={competitionLabel}
              onUpdate={loadData}
              onDelete={handleDelete}
              dirtyMap={dirtyMap}
              onDirtyChange={handleDirtyChange}
              teacherNames={mergedTeacherNames}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Competition;
