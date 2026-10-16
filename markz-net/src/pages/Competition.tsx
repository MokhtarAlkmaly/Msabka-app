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
  Trash2,
  Calendar,
  Save,
  RefreshCw,
  Users,
  Trophy,
  BookOpenCheck,
  WalletCards,
  ArrowRight,
  GraduationCap,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { OfflineBadge } from "@/components/OfflineBadge";
import { BRAND_HEADER, BRAND_SUPERVISOR } from "@/lib/brand";
import { Student, HifzHistory, YearData, START_YEAR, END_YEAR } from "@/types/student";
import {
  loadAllStudentsWithData,
  loadGlobalStudents,
  saveStudent,
  getActiveYear,
  setActiveYear,
  saveHifzHistory,
  saveYearData,
  migrateYearData,
  mergeDuplicateStudents,
  loadTeachers as loadCachedTeachers,
  deleteStudentFromYear,
  deleteStudentsFromYear,
} from "@/utils/storage";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";

interface DirtyData {
  name: string;
  teacher: string;
  history: HifzHistory;
  yearData: YearData;
}

const Competition = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentYear, setCurrentYear] = useState<string>("1447");
  const [competitionType, setCompetitionType] = useState<"ramadan" | "dhul_hijjah">(
    () => (localStorage.getItem("competitionType") as "ramadan" | "dhul_hijjah") || "ramadan",
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirtyMap, setDirtyMap] = useState<Record<number, DirtyData>>({});
  const [teacherNames, setTeacherNames] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  const isDirty = Object.keys(dirtyMap).length > 0;
  const dataYearKey = competitionType === "dhul_hijjah" ? `${currentYear}D` : currentYear;
  const competitionLabel =
    competitionType === "dhul_hijjah" ? "مسابقة عشر ذي الحجة" : "المسابقة الرمضانية";

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

  useEffect(() => {
    const init = async () => {
      const year = await getActiveYear();
      setCurrentYear(year);
      try {
        await mergeDuplicateStudents();
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
      await loadData();

      toast({
        title: "تم الحفظ",
        description: `تم حفظ بيانات ${entries.length} طالب بنجاح`,
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

  const handleCompetitionTypeChange = (type: "ramadan" | "dhul_hijjah") => {
    if (isDirty && !confirm("هناك تغييرات غير محفوظة، هل تريد المتابعة بدون حفظ؟")) return;
    setCompetitionType(type);
    localStorage.setItem("competitionType", type);
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

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    name: string;
    years: string[];
  } | null>(null);
  const [deleteMode, setDeleteMode] = useState<"all" | "year" | "selected">("year");
  const [selectedToDelete, setSelectedToDelete] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const toggleSelectedToDelete = (id: number) => {
    setSelectedToDelete((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      if (deleteMode === "all") {
        const { deleteAllStudents } = await import("@/utils/storage");
        await deleteAllStudents();
        setStudents([]);
        setDirtyMap({});
        toast({ title: "تم الحذف", description: "تم حذف جميع البيانات", variant: "destructive" });
      } else if (deleteMode === "year") {
        const { deleteYearData } = await import("@/utils/storage");
        await deleteYearData(dataYearKey);
        setDirtyMap({});
        toast({
          title: "تم الحذف",
          description: `تم حذف بيانات عام ${currentYear}هـ فقط`,
          variant: "destructive",
        });
        await loadData();
      } else {
        if (selectedToDelete.size === 0) {
          setDeleting(false);
          return;
        }
        await deleteStudentsFromYear(dataYearKey, Array.from(selectedToDelete));
        setSelectedToDelete(new Set());
        toast({
          title: "تم الحذف",
          description: `تم فصل ${selectedToDelete.size} طالب عن عام ${currentYear}هـ مع إبقائهم في السجل العام`,
          variant: "destructive",
        });
        await loadData();
      }
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handlePrint = async () => {
    const { printCurrentPage } = await import("@/utils/nativePrint");
    printCurrentPage(`كشف_${competitionLabel}_${currentYear}`);
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
                  alt="Markz Net — نسخة بلا إنترنت"
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
                  {BRAND_HEADER} · {BRAND_SUPERVISOR}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-3xl bg-white/10 p-3 text-sm text-white/85 ring-1 ring-white/15 backdrop-blur sm:min-w-52">
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold">العام: {currentYear}هـ</span>
                <OfflineBadge tone="glass" />
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
                onClick={() => void loadData()}
                variant="outline"
                className="h-12 gap-2 rounded-2xl"
              >
                <RefreshCw className="h-4 w-4" />
                تحديث
              </Button>

              <Button
                onClick={() => {
                  setDeleteMode("year");
                  setSelectedToDelete(new Set());
                  setDeleteDialogOpen(true);
                }}
                variant="destructive"
                className="h-12 gap-2 rounded-2xl"
              >
                <Trash2 className="h-4 w-4" />
                حذف بيانات
              </Button>
            </div>
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

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-destructive">حذف بيانات المسابقة</DialogTitle>
          </DialogHeader>

          <RadioGroup
            value={deleteMode}
            onValueChange={(v) => setDeleteMode(v as typeof deleteMode)}
            className="space-y-3"
          >
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 hover:bg-secondary/50">
              <RadioGroupItem value="year" id="mode-year" className="mt-1" />
              <div>
                <div className="font-bold">
                  حذف بيانات {competitionLabel} لعام {currentYear}هـ فقط
                </div>
                <div className="text-xs text-muted-foreground">
                  تُحذف الدرجات والحفظ لهذا العام فقط، وتبقى بيانات الطلاب وسجلاتهم كما هي
                </div>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 hover:bg-secondary/50">
              <RadioGroupItem value="selected" id="mode-selected" className="mt-1" />
              <div className="w-full">
                <div className="font-bold">حذف طلاب محددين</div>
                <div className="text-xs text-muted-foreground">تُحذف بيانات الطلاب المحددين</div>
                {deleteMode === "selected" && (
                  <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg bg-secondary/40 p-2">
                    {students.length === 0 ? (
                      <p className="p-2 text-xs text-muted-foreground">لا يوجد طلاب بهذا العام</p>
                    ) : (
                      students.map((s) => (
                        <label
                          key={s.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 hover:bg-background"
                        >
                          <Checkbox
                            checked={selectedToDelete.has(s.id)}
                            onCheckedChange={() => toggleSelectedToDelete(s.id)}
                          />
                          <span className="text-sm">
                            {s.name || "بدون اسم"}{" "}
                            <span className="text-xs text-muted-foreground">— {s.teacher}</span>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 hover:bg-destructive/10">
              <RadioGroupItem value="all" id="mode-all" className="mt-1" />
              <div>
                <div className="font-bold text-destructive">حذف كل البيانات نهائياً</div>
                <div className="text-xs text-muted-foreground">إجراء لا يمكن التراجع عنه</div>
              </div>
            </label>
          </RadioGroup>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={deleting || (deleteMode === "selected" && selectedToDelete.size === 0)}
              onClick={handleConfirmDelete}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "جارٍ الحذف..." : "تأكيد الحذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Competition;
