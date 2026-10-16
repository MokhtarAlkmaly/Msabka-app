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
  LogOut,
  Users,
  BookOpenCheck,
  Heart,
  Calendar,
  Sparkles,
  Plus,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { OfflineBadge } from "@/components/OfflineBadge";
import { BRAND_HEADER, BRAND_SIGNATURE } from "@/lib/brand";
import { Student, CustomColumnDef, DEFAULT_STATUSES, GENDER_OPTIONS } from "@/types/student";
import { DEFAULT_SCHOOL_GRADES } from "@/utils/schoolGrades";
import {
  loadGlobalStudentsWithYears,
  getActiveYear,
  loadTeachers,
  loadCustomColumns,
  saveCustomColumns,
  loadStudentStatuses,
  saveStudentStatuses,
  saveStudent,
  deleteStudent,
} from "@/utils/storage";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentYear, setCurrentYear] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [teacherNames, setTeacherNames] = useState<string[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumnDef[]>([]);
  const [studentStatuses, setStudentStatuses] = useState<string[]>(DEFAULT_STATUSES);
  const [dirtyMap, setDirtyMap] = useState<Record<number, Student>>({});
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({
    name: "",
    teacher: "",
    gender: "",
    school_grade: "",
  });

  const { toast } = useToast();
  const { signOut } = useAuth();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // السجل الشامل لكل الأعوام: لا يرتبط بعام محدد. يُهيَّئ الكاش أولاً
      // لتقرأ الإعدادات والمعلمين والمعلمات من نفس لقطة الحساب.
      const allStudents = await loadGlobalStudentsWithYears();
      const [teachers, columns, statuses] = await Promise.all([
        loadTeachers(),
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
  }, [toast]);

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
      const student = students.find((s) => s.id === id);
      const name = student?.name || "هذا الطالب";
      // السجل شامل لكل الأعوام، لذا الحذف هنا يمس بيانات الطالب في جميع
      // الأعوام والمسابقات — نطلب تأكيداً صريحاً قبل التنفيذ.
      if (
        !confirm(
          `حذف ${name} من السجل الشامل نهائياً؟\nستُحذف بياناته في جميع الأعوام والمسابقات ولا يمكن التراجع.`,
        )
      ) {
        return;
      }
      await deleteStudent(id);
      setDirtyMap((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      await loadData();
    },
    [loadData, students],
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

    setAddingStudent(true);
    try {
      const teacher = newStudent.teacher.trim();
      const id = await saveStudent({
        name,
        teacher,
        gender: newStudent.gender || undefined,
        school_grade: newStudent.school_grade || undefined,
      });
      if (id === null) {
        throw new Error("Unable to create student without an authenticated user");
      }

      await loadData();
      setNewStudent({ name: "", teacher: "", gender: "", school_grade: "" });
      setAddStudentOpen(false);
      toast({
        title: "تمت إضافة الطالب",
        description: `أُضيف ${name} إلى السجل الشامل (كل الأعوام)`,
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

  useEffect(() => {
    // العام النشط يبقى مرجعاً للملف الشامل للطالب واستيراد/تصدير بيانات عام،
    // لكن جدول الإدارة نفسه شامل لكل الأعوام ولا يرتبط به.
    const init = async () => {
      const year = await getActiveYear();
      setCurrentYear(year);
    };
    void init();
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
  // عدد الأعوام التي يغطيها السجل (ذو الحجة تُحسب ضمن عامها)
  const yearsCoveredCount = useMemo(() => {
    const years = new Set<string>();
    students.forEach((s) =>
      (s.registered_years || []).forEach((y) => years.add(y.replace(/D$/, ""))),
    );
    return years.size;
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
                      alt="Markz Net — نسخة بلا إنترنت"
                      className="h-16 w-16 object-contain sm:h-20 sm:w-20"
                    />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs text-white/90 ring-1 ring-white/15">
                      <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                      السجل العام والملف الشامل
                    </div>
                    <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl text-white">
                      {BRAND_HEADER}
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
                    <OfflineBadge tone="glass" />
                  </div>
                  <div>{hijriDate}</div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
                    <div className="flex items-center gap-1 text-xs font-bold text-amber-200">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>سجل شامل لكل الأعوام ({yearsCoveredCount} عامًا)</span>
                    </div>
                    <Button
                      onClick={() => void signOut().then(() => window.location.replace("/auth"))}
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
                  <div className="text-xs text-white/70">إجمالي طلاب السجل (كل الأعوام)</div>
                </div>
                <div className="rounded-3xl bg-white/14 p-3.5 ring-1 ring-white/15 backdrop-blur">
                  <Calendar className="mb-2 h-5 w-5 text-amber-300" />
                  <div className="text-2xl font-black">{yearsCoveredCount}</div>
                  <div className="text-xs text-white/70">أعوام يشملها السجل</div>
                </div>
                <div className="rounded-3xl bg-white/14 p-3.5 ring-1 ring-white/15 backdrop-blur">
                  <Heart className="mb-2 h-5 w-5 text-amber-300" />
                  <div className="text-2xl font-black">{orphansOrSpecialCount}</div>
                  <div className="text-xs text-white/70">أيتام وحالات خاصة</div>
                </div>
                <div className="rounded-3xl bg-white/14 p-3.5 ring-1 ring-white/15 backdrop-blur">
                  <BookOpenCheck className="mb-2 h-5 w-5 text-amber-300" />
                  <div className="text-2xl font-black">{distinctTeachers}</div>
                  <div className="text-xs text-white/70">حلقات المعلمين والمعلمات المسجلة</div>
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
                  سجل الطلاب الشامل — كل الأعوام
                </h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {students.length} طالب
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => setAddStudentOpen(true)}
                  size="sm"
                  className="h-9 gap-1.5 rounded-xl text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة طالب جديد
                </Button>
                <Button
                  onClick={() => void loadData()}
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 rounded-xl text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  تحديث
                </Button>
              </div>
            </div>

            {currentYear && <ImportExport onDataImported={loadData} currentYear={currentYear} />}

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
              if (!open) setNewStudent({ name: "", teacher: "", gender: "", school_grade: "" });
            }}
          >
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  إضافة طالب جديد
                </DialogTitle>
                <DialogDescription>
                  سيُضاف الطالب إلى السجل الشامل المشترك لكل الأعوام، ويمكن استدعاؤه بعد ذلك إلى
                  المسابقة الرمضانية أو أي صفحة أخرى.
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
                    المعلم/ة / الحلقة
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

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-foreground">السنة الدراسية</label>
                  <Select
                    value={newStudent.school_grade || "unspecified"}
                    onValueChange={(grade) =>
                      setNewStudent((current) => ({
                        ...current,
                        school_grade: grade === "unspecified" ? "" : grade,
                      }))
                    }
                    disabled={addingStudent}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="غير محددة" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[60vh]">
                      <SelectItem value="unspecified">غير محددة</SelectItem>
                      {DEFAULT_SCHOOL_GRADES.map((grade) => (
                        <SelectItem key={grade} value={grade}>
                          {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    نفس قائمة «كل السنوات الدراسية» في جدول الطلاب، ويمكن تغييرها لاحقًا من الجدول.
                  </p>
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
            {BRAND_SIGNATURE}
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Index;
