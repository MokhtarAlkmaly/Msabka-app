import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InstallPrompt } from "@/components/InstallPrompt";
import { StudentsTable } from "@/components/StudentsTable";
import { ImportExport } from "@/components/ImportExport";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  Wifi,
  WifiOff,
  LogOut,
  Users,
  Trophy,
  BookOpenCheck,
  Heart,
  Calendar,
  Sparkles,
  Plus,
} from "lucide-react";
import logo from "@/assets/logo.png";
import {
  Student,
  START_YEAR,
  END_YEAR,
  CustomColumnDef,
  DEFAULT_STATUSES,
  GENDER_OPTIONS,
} from "@/types/student";
import {
  loadStudentsForYear,
  getActiveYear,
  setActiveYear,
  syncToCloud,
  syncFromCloud,
  loadTeachers,
  loadCustomColumns,
  saveCustomColumns,
  loadStudentStatuses,
  saveStudentStatuses,
  saveStudent,
  deleteStudent,
  registerStudentInYear,
} from "@/utils/storage";
import { getPendingChanges } from "@/utils/localDB";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Progress } from "@/components/ui/progress";

const Index = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentYear, setCurrentYear] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
    label?: string;
  } | null>(null);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [teacherNames, setTeacherNames] = useState<string[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumnDef[]>([]);
  const [studentStatuses, setStudentStatuses] = useState<string[]>(DEFAULT_STATUSES);
  const [dirtyMap, setDirtyMap] = useState<Record<number, Student>>({});
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: "", teacher: "", gender: "" });

  const { toast } = useToast();
  const { user, signOut } = useAuth();

  const loadData = useCallback(async () => {
    if (!currentYear) return;
    setLoading(true);
    try {
      // Load the registry first. It initializes the user-scoped cache so the
      // related settings and teacher list read from the same account snapshot.
      const allStudents = await loadStudentsForYear(currentYear);
      const [teachers, columns, statuses] = await Promise.all([
        loadTeachers(currentYear),
        loadCustomColumns(),
        loadStudentStatuses(),
      ]);
      setStudents(allStudents);
      setTeacherNames(teachers.map((t) => t.name));
      setCustomColumns(columns);
      setStudentStatuses(statuses);
      setDirtyMap({});
    } catch (error) {
      console.error("Failed to load student registry:", error);
      toast({
        title: "تعذر تحميل سجل الطلاب",
        description: "تحقق من الاتصال ثم حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentYear, toast, user]);

  const handleSaveStudent = useCallback(
    async (student: Partial<Student> & { id?: number; name: string }) => {
      const id = await saveStudent(student);
      if (id === null) {
        throw new Error("Unable to save student without an authenticated user");
      }
      setDirtyMap((current) => {
        const next = { ...current };
        if (student.id) delete next[student.id];
        return next;
      });
      return id;
    },
    [],
  );

  const handleDeleteStudent = useCallback(
    async (id: number) => {
      await deleteStudent(id);
      setDirtyMap((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      await loadData();
    },
    [loadData],
  );

  const handleAddStudent = async () => {
    const name = newStudent.name.trim();
    if (!name) {
      toast({
        title: "اسم الطالب مطلوب",
        description: "أدخل اسم الطالب قبل الحفظ",
        variant: "destructive",
      });
      return;
    }
    if (!currentYear) return;

    setAddingStudent(true);
    try {
      const teacher = newStudent.teacher.trim();
      const id = await saveStudent({
        name,
        teacher,
        gender: newStudent.gender || undefined,
      });
      if (id === null) {
        throw new Error("Unable to create student without an authenticated user");
      }

      await registerStudentInYear(currentYear, id, teacher);
      await loadData();
      setNewStudent({ name: "", teacher: "", gender: "" });
      setAddStudentOpen(false);
      toast({
        title: "تمت إضافة الطالب",
        description: `أُضيف ${name} إلى سجل عام ${currentYear}هـ`,
      });
    } catch (error) {
      console.error("Failed to add student:", error);
      toast({
        title: "تعذرت إضافة الطالب",
        description: "حاول مرة أخرى بعد التحقق من البيانات",
        variant: "destructive",
      });
    } finally {
      setAddingStudent(false);
    }
  };

  const handleAddCustomColumn = useCallback(
    async (column: CustomColumnDef) => {
      const next = [...customColumns, column];
      await saveCustomColumns(next);
      setCustomColumns(next);
    },
    [customColumns],
  );

  const handleDeleteCustomColumn = useCallback(
    async (columnId: string) => {
      const next = customColumns.filter((column) => column.id !== columnId);
      await saveCustomColumns(next);
      setCustomColumns(next);
    },
    [customColumns],
  );

  const handleAddStatus = useCallback(
    async (status: string) => {
      if (studentStatuses.includes(status)) return;
      const next = [...studentStatuses, status];
      await saveStudentStatuses(next);
      setStudentStatuses(next);
    },
    [studentStatuses],
  );

  const handleDirtyChange = useCallback((studentId: number, data: Student) => {
    setDirtyMap((current) => ({ ...current, [studentId]: data }));

    // Keep inline edits local-first as well. The table emits this callback on
    // every field change and the storage layer queues the cloud update when
    // connectivity is available.
    void saveStudent(data)
      .then(() => {
        setStudents((current) =>
          current.map((student) => (student.id === studentId ? data : student)),
        );
        setDirtyMap((current) => {
          if (current[studentId] !== data) return current;
          const next = { ...current };
          delete next[studentId];
          return next;
        });
      })
      .catch((error) => {
        console.error("Failed to save inline student edit:", error);
      });
  }, []);

  // Auto-sync queued offline changes
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
    };
    void init();
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleYearChange = async (year: string) => {
    setCurrentYear(year);
    await setActiveYear(year);
    toast({
      title: "تم تغيير السنة",
      description: `تم التبديل إلى عام ${year}هـ`,
    });
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
    setSyncProgress({ current: 0, total: 13, label: "بدء التنزيل" });
    try {
      const success = await syncFromCloud((current, total, label) =>
        setSyncProgress({ current, total, label }),
      );
      if (success) {
        await loadData();
        toast({ title: "تمت المزامنة", description: "تم تحديث البيانات من السحابة بنجاح" });
      } else {
        toast({ title: "خطأ", description: "فشل في المزامنة", variant: "destructive" });
      }
    } catch (error) {
      console.error("Cloud sync error:", error);
      toast({ title: "خطأ", description: "فشل في المزامنة", variant: "destructive" });
    } finally {
      setSyncProgress(null);
      setSyncing(false);
    }
  };

  const now = new Date();
  const dayName = now.toLocaleDateString("ar-EG", { weekday: "long" });
  const hijriDate = now.toLocaleDateString("ar-SA-u-ca-islamic-umalqura", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Calculate stats
  const totalStudents = students.length;
  const orphansOrSpecialCount = students.filter(
    (s) => s.status && s.status !== "مستمر" && s.status !== "منتظم",
  ).length;
  const distinctTeachers = useMemo(() => {
    const set = new Set(students.map((s) => s.teacher?.trim()).filter(Boolean));
    return set.size;
  }, [students]);

  return (
    <div
      className="min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.14),transparent_34rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)/0.45))]"
      dir="rtl"
    >
      <InstallPrompt />

      {/* The authenticated route provides the shared sidebar and reserves its
          desktop width. This page only owns the registry content. */}
      <div className="flex min-h-screen w-full flex-col">
        <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
          {/* Header */}
          <header className="relative isolate mx-3 mt-3 px-4 pb-6 pt-4 text-primary-foreground">
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-primary via-emerald-700 to-teal-950 shadow-2xl shadow-primary/20" />
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem] bg-[radial-gradient(circle_at_18%_16%,rgba(255,255,255,.18),transparent_13rem)]" />

            <div className="container relative z-10 mx-auto max-w-7xl">
              <div className="flex flex-col gap-4 py-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-3xl bg-white/95 p-2 shadow-xl shadow-black/10 ring-1 ring-white/40">
                    <img
                      src={logo}
                      alt="مركز إنماء الأهلي الخيري"
                      className="h-16 w-16 object-contain sm:h-20 sm:w-20"
                    />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs text-white/90 ring-1 ring-white/15">
                      <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                      السجل العام والملف الشامل
                    </div>
                    <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl text-white">
                      مركز إنماء الاهلي الخيري - قسم القرآن الكريم
                    </h1>
                    <p className="mt-1 text-xs text-white/80 sm:text-sm">
                      السجل الرسمي الموحد لجميع طلاب الحلقات والمسابقات القرآنية · الإشراف - شرعب
                      الرونة
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 rounded-3xl bg-white/10 p-3 text-xs text-white/85 ring-1 ring-white/15 backdrop-blur sm:min-w-56 sm:text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-semibold">{dayName}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                        online ? "bg-emerald-300/20 text-emerald-50" : "bg-red-300/20 text-red-50"
                      }`}
                    >
                      {online ? (
                        <Wifi className="h-3.5 w-3.5" />
                      ) : (
                        <WifiOff className="h-3.5 w-3.5" />
                      )}
                      {online ? "متصل" : "غير متصل"}
                    </span>
                  </div>
                  <div>{hijriDate}</div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
                    <div className="flex items-center gap-1 text-xs">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>العام:</span>
                      <Select value={currentYear} onValueChange={(v) => void handleYearChange(v)}>
                        <SelectTrigger className="h-6 w-20 text-xs bg-white/10 border-white/20 text-white font-bold p-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from(
                            { length: END_YEAR - START_YEAR + 1 },
                            (_, i) => START_YEAR + i,
                          ).map((y) => (
                            <SelectItem key={y} value={String(y)}>
                              {y}هـ
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={signOut}
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-white/80 hover:bg-white/10 hover:text-white"
                    >
                      <LogOut className="h-3 w-3" />
                      خروج
                    </Button>
                  </div>
                </div>
              </div>

              {/* Statistics Overview */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-3xl bg-white/14 p-3.5 ring-1 ring-white/15 backdrop-blur">
                  <Users className="mb-2 h-5 w-5 text-amber-300" />
                  <div className="text-2xl font-black">{totalStudents}</div>
                  <div className="text-xs text-white/70">إجمالي الطلاب المسجلين</div>
                </div>
                <div className="rounded-3xl bg-white/14 p-3.5 ring-1 ring-white/15 backdrop-blur">
                  <Trophy className="mb-2 h-5 w-5 text-amber-300" />
                  <div className="text-2xl font-black">{totalStudents}</div>
                  <div className="text-xs text-white/70">السجل الأساسي المعتمد</div>
                </div>
                <div className="rounded-3xl bg-white/14 p-3.5 ring-1 ring-white/15 backdrop-blur">
                  <Heart className="mb-2 h-5 w-5 text-amber-300" />
                  <div className="text-2xl font-black">{orphansOrSpecialCount}</div>
                  <div className="text-xs text-white/70">أيتام وحالات خاصة</div>
                </div>
                <div className="rounded-3xl bg-white/14 p-3.5 ring-1 ring-white/15 backdrop-blur">
                  <BookOpenCheck className="mb-2 h-5 w-5 text-amber-300" />
                  <div className="text-2xl font-black">{distinctTeachers}</div>
                  <div className="text-xs text-white/70">حلقات ومعلمات مسجلات</div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Table Content */}
          <main className="container mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-6 space-y-4">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/60 bg-card/85 p-3 shadow-md backdrop-blur">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground sm:text-lg">
                  جدول طلاب العام {currentYear}هـ
                </h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {students.length} طالب
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => setAddStudentOpen(true)}
                  disabled={!currentYear}
                  size="sm"
                  className="h-9 gap-1.5 rounded-xl text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة طالب جديد
                </Button>
                <Button
                  onClick={handleSyncFromCloud}
                  disabled={syncing || !online}
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 rounded-xl text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                  {syncProgress ? `${syncProgress.current}/${syncProgress.total}` : "مزامنة سحابية"}
                </Button>
              </div>
            </div>

            {currentYear && <ImportExport onDataImported={loadData} currentYear={currentYear} />}

            {syncProgress && (
              <div className="space-y-1">
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

            {/* Students Table */}
            {loading ? (
              <div className="rounded-[1.75rem] border border-white/70 bg-card/80 py-16 text-center text-muted-foreground shadow-xl shadow-primary/5">
                جارٍ تحميل سجل الطلاب الرسمي...
              </div>
            ) : (
              <StudentsTable
                students={students}
                onUpdate={loadData}
                onSaveStudent={handleSaveStudent}
                onDeleteStudent={handleDeleteStudent}
                teacherNames={teacherNames}
                customColumns={customColumns}
                onAddCustomColumn={handleAddCustomColumn}
                onDeleteCustomColumn={handleDeleteCustomColumn}
                studentStatuses={studentStatuses}
                onAddStatus={handleAddStatus}
                dirtyMap={dirtyMap}
                onDirtyChange={handleDirtyChange}
                activeYear={currentYear}
              />
            )}
          </main>

          <Dialog
            open={addStudentOpen}
            onOpenChange={(open) => {
              if (addingStudent) return;
              setAddStudentOpen(open);
              if (!open) setNewStudent({ name: "", teacher: "", gender: "" });
            }}
          >
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  إضافة طالب جديد
                </DialogTitle>
                <DialogDescription>
                  سيُضاف الطالب إلى سجل إدارة الطلاب للعام {currentYear}هـ، ويمكن استدعاؤه بعد ذلك
                  إلى المسابقات.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label htmlFor="new-student-name" className="text-sm font-bold text-foreground">
                    اسم الطالب <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="new-student-name"
                    value={newStudent.name}
                    onChange={(event) =>
                      setNewStudent((current) => ({ ...current, name: event.target.value }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleAddStudent();
                    }}
                    placeholder="أدخل الاسم الكامل"
                    autoFocus
                    disabled={addingStudent}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="new-student-teacher"
                    className="text-sm font-bold text-foreground"
                  >
                    المعلمة / الحلقة
                  </label>
                  <Input
                    id="new-student-teacher"
                    value={newStudent.teacher}
                    onChange={(event) =>
                      setNewStudent((current) => ({ ...current, teacher: event.target.value }))
                    }
                    placeholder="اختياري"
                    list="student-teacher-names"
                    disabled={addingStudent}
                    className="rounded-xl"
                  />
                  <datalist id="student-teacher-names">
                    {teacherNames.map((teacher) => (
                      <option key={teacher} value={teacher} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-foreground">الجنس</label>
                  <Select
                    value={newStudent.gender || "unspecified"}
                    onValueChange={(gender) =>
                      setNewStudent((current) => ({
                        ...current,
                        gender: gender === "unspecified" ? "" : gender,
                      }))
                    }
                    disabled={addingStudent}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="غير محدد" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unspecified">غير محدد</SelectItem>
                      {GENDER_OPTIONS.map((gender) => (
                        <SelectItem key={gender} value={gender}>
                          {gender}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAddStudentOpen(false)}
                  disabled={addingStudent}
                >
                  إلغاء
                </Button>
                <Button
                  onClick={() => void handleAddStudent()}
                  disabled={addingStudent || !newStudent.name.trim()}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  {addingStudent ? "جارٍ الإضافة..." : "إضافة الطالب"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Footer */}
          <footer className="mt-auto px-4 py-6 text-center text-xs text-muted-foreground">
            مركز إنماء الأهلي الخيري - قسم القرآن الكريم · تصميم أ/ مختار الكمالي
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Index;
