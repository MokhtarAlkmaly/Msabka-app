import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowRight,
  CalendarDays,
  GraduationCap,
  Loader2,
  Plus,
  Search,
  Trash2,
  UsersRound,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { END_YEAR, START_YEAR, Student } from "@/types/student";
import {
  deleteStudentFromYear,
  getActiveYear,
  loadGlobalStudents,
  loadStudentsForYear,
  loadTeachers,
  registerStudentInYear,
  saveTeacher,
  saveYearData,
  setActiveYear,
} from "@/utils/storage";

const YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, index) =>
  String(START_YEAR + index),
);

interface TeacherRow {
  id: string;
  name: string;
  year: string;
}

const Halaqat = () => {
  const { toast } = useToast();
  const { viewAs } = useAuth();
  const [year, setYear] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [globalStudents, setGlobalStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [addTeacherOpen, setAddTeacherOpen] = useState(false);
  const [teacherName, setTeacherName] = useState("");
  const [addStudentsOpen, setAddStudentsOpen] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentTeacher, setStudentTeacher] = useState("unassigned");
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [removing, setRemoving] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!year) return;
    setLoading(true);
    try {
      const [yearStudents, allStudents, yearTeachers] = await Promise.all([
        loadStudentsForYear(year),
        loadGlobalStudents(),
        loadTeachers(year),
      ]);
      setStudents(yearStudents);
      setGlobalStudents(allStudents);
      setTeachers(yearTeachers as TeacherRow[]);
    } catch (error) {
      console.error("تعذر تحميل إدارة الحلقات:", error);
      toast({
        title: "تعذر تحميل الحلقات",
        description: "تحقق من الاتصال وحاول مرة أخرى.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, year]);

  useEffect(() => {
    void getActiveYear().then(setYear);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const teacherNames = useMemo(() => {
    const names = new Set(teachers.map((teacher) => teacher.name).filter(Boolean));
    students.forEach((student) => {
      if (student.teacher.trim()) names.add(student.teacher.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, "ar"));
  }, [students, teachers]);

  const groupedStudents = useMemo(() => {
    const groups = new Map<string, Student[]>();
    teacherNames.forEach((teacherName) => groups.set(teacherName, []));
    students.forEach((student) => {
      const name = student.teacher.trim() || "بدون حلقة";
      const list = groups.get(name) || [];
      list.push(student);
      groups.set(name, list);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "بدون حلقة") return 1;
      if (b === "بدون حلقة") return -1;
      return a.localeCompare(b, "ar");
    });
  }, [students, teacherNames]);

  const availableStudents = useMemo(() => {
    const assignedIds = new Set(students.map((student) => student.id));
    const query = studentQuery.trim().toLowerCase();
    return globalStudents
      .filter((student) => !assignedIds.has(student.id))
      .filter(
        (student) => !query || `${student.name} ${student.teacher}`.toLowerCase().includes(query),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [globalStudents, studentQuery, students]);

  const handleYearChange = async (nextYear: string) => {
    setYear(nextYear);
    await setActiveYear(nextYear);
  };

  const addTeacher = async () => {
    const name = teacherName.trim();
    if (!name || !year || viewAs) return;
    if (teacherNames.includes(name)) {
      toast({ title: "المعلم/ة موجود", description: "هذا المعلم/ة مضاف لهذا العام مسبقاً." });
      return;
    }
    try {
      await saveTeacher({ name, year });
      setTeacherName("");
      setAddTeacherOpen(false);
      toast({ title: "تمت إضافة المعلم/ة", description: `${name} — عام ${year}هـ` });
      await loadData();
    } catch (error) {
      toast({
        title: "تعذر إضافة المعلم/ة",
        description: "حاول مرة أخرى.",
        variant: "destructive",
      });
    }
  };

  const toggleStudent = (studentId: number) => {
    setSelectedStudents((previous) => {
      const next = new Set(previous);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const addStudentsToYear = async () => {
    if (selectedStudents.size === 0 || !year || viewAs) return;
    try {
      for (const studentId of selectedStudents) {
        await registerStudentInYear(
          year,
          studentId,
          studentTeacher === "unassigned" ? "" : studentTeacher,
        );
      }
      toast({
        title: "تم ربط الطلاب",
        description: `تم إدخال ${selectedStudents.size} طالب إلى عام ${year}هـ.`,
      });
      setSelectedStudents(new Set());
      setStudentQuery("");
      setStudentTeacher("unassigned");
      setAddStudentsOpen(false);
      await loadData();
    } catch (error) {
      toast({ title: "تعذر ربط الطلاب", description: "حاول مرة أخرى.", variant: "destructive" });
    }
  };

  const moveStudent = async (student: Student, nextTeacher: string) => {
    if (!student.yearData || !year || viewAs) return;
    setSaving(student.id);
    try {
      await saveYearData(year, student.id, {
        ...student.yearData,
        teacher: nextTeacher === "unassigned" ? "" : nextTeacher,
      });
      setStudents((current) =>
        current.map((item) =>
          item.id === student.id
            ? {
                ...item,
                teacher: nextTeacher === "unassigned" ? "" : nextTeacher,
                yearData: {
                  ...item.yearData!,
                  teacher: nextTeacher === "unassigned" ? "" : nextTeacher,
                },
              }
            : item,
        ),
      );
    } catch (error) {
      toast({ title: "تعذر نقل الطالب", description: "حاول مرة أخرى.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const removeStudentFromYear = async (student: Student) => {
    if (viewAs || !year) return;
    if (
      !confirm(
        `إخراج «${student.name || "بدون اسم"}» من عام ${year}هـ فقط؟ سيبقى ملفه في السجل الشامل.`,
      )
    )
      return;
    setRemoving(student.id);
    try {
      await deleteStudentFromYear(year, student.id);
      toast({
        title: "تم إخراج الطالب من العام",
        description: "بقي ملف الطالب محفوظاً في السجل الشامل.",
        variant: "destructive",
      });
      await loadData();
    } catch (error) {
      toast({ title: "تعذر إخراج الطالب", description: "حاول مرة أخرى.", variant: "destructive" });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div
      className="min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.14),transparent_34rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)/0.45))]"
      dir="rtl"
    >
      <header className="mx-3 mt-3 rounded-[2rem] bg-gradient-to-br from-primary via-emerald-700 to-teal-950 px-4 py-5 text-primary-foreground shadow-2xl shadow-primary/20">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="شعار المركز"
                className="h-14 w-14 rounded-2xl bg-white/95 p-1 object-contain"
              />
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-black">
                  <UsersRound className="h-6 w-6" /> إدارة الحلقات
                </h1>
                <p className="mt-1 text-sm text-white/75">
                  ربط الطلاب بالمعلمين والمعلمات وإدارة حلقات كل عام بشكل مستقل
                </p>
              </div>
            </div>
            <Link to="/">
              <Button variant="ghost" className="gap-1 text-primary-foreground">
                <ArrowRight className="h-4 w-4" /> السجل الرئيسي
              </Button>
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
            <CalendarDays className="h-5 w-5 text-amber-300" />
            <span className="font-semibold">العام النشط</span>
            <Select value={year} onValueChange={(value) => void handleYearChange(value)}>
              <SelectTrigger className="h-9 w-28 rounded-xl border-white/20 bg-white/10 font-bold text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}هـ
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="mr-auto rounded-full bg-white/10 px-3 py-1 text-xs">
              {students.length} طالب في العام
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-5 px-3 py-5 sm:px-4 sm:py-7">
        {viewAs && (
          <div className="rounded-2xl border border-amber-300/60 bg-amber-100/80 p-3 text-sm text-amber-900">
            وضع الاطلاع للقراءة فقط: لا يمكن تعديل الحلقات أو الطلاب.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!!viewAs}
            onClick={() => setAddTeacherOpen(true)}
            className="gap-2 rounded-2xl"
          >
            <Plus className="h-4 w-4" /> إضافة معلم/ة لهذا العام
          </Button>
          <Button
            disabled={!!viewAs}
            onClick={() => setAddStudentsOpen(true)}
            variant="outline"
            className="gap-2 rounded-2xl"
          >
            <GraduationCap className="h-4 w-4" /> ربط طلاب من السجل الشامل
          </Button>
        </div>

        {loading ? (
          <Card className="p-12 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
            جارٍ تحميل حلقات عام {year}هـ...
          </Card>
        ) : groupedStudents.length === 0 ? (
          <Card className="p-12 text-center">
            <UsersRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-bold">لا توجد حلقات أو طلاب مسجلون في هذا العام.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              أضف معلم/ة أو اربط طلاباً من السجل الشامل للبدء.
            </p>
          </Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {groupedStudents.map(([teacher, teacherStudents]) => (
              <Card
                key={teacher}
                className="overflow-hidden rounded-[1.75rem] border-white/70 bg-card/90 shadow-xl shadow-primary/5"
              >
                <CardHeader className="border-b bg-primary/[0.04] pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">{teacher}</CardTitle>
                      <CardDescription>{teacherStudents.length} طالب</CardDescription>
                    </div>
                    <UsersRound className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 p-3">
                  {teacherStudents.length === 0 ? (
                    <p className="p-3 text-center text-sm text-muted-foreground">
                      لا يوجد طلاب مرتبطون بهذه الحلقة بعد.
                    </p>
                  ) : (
                    teacherStudents.map((student) => (
                      <div
                        key={student.id}
                        className="flex flex-wrap items-center gap-2 rounded-2xl border bg-background/70 p-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">{student.name || "بدون اسم"}</div>
                          <div className="text-xs text-muted-foreground">
                            رقم القيد: {student.id}
                          </div>
                        </div>
                        <Select
                          value={student.teacher || "unassigned"}
                          onValueChange={(value) => void moveStudent(student, value)}
                          disabled={!!viewAs || saving === student.id}
                        >
                          <SelectTrigger className="h-9 w-36 rounded-xl text-xs">
                            <SelectValue placeholder="الحلقة" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">بدون حلقة</SelectItem>
                            {teacherNames.map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!!viewAs || removing === student.id}
                          onClick={() => void removeStudentFromYear(student)}
                          className="h-9 gap-1 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" /> إخراج
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={addTeacherOpen} onOpenChange={setAddTeacherOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة معلم/ة لعام {year}هـ</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="halaqat-teacher-name">اسم المعلم/ة</Label>
            <Input
              id="halaqat-teacher-name"
              value={teacherName}
              onChange={(event) => setTeacherName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void addTeacher();
              }}
              placeholder="اكتب اسم المعلم/ة"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTeacherOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={() => void addTeacher()} disabled={!teacherName.trim()}>
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addStudentsOpen}
        onOpenChange={(open) => {
          setAddStudentsOpen(open);
          if (!open) {
            setSelectedStudents(new Set());
            setStudentQuery("");
          }
        }}
      >
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>ربط طلاب من السجل الشامل (كل الأعوام) بعام {year}هـ</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={studentQuery}
                onChange={(event) => setStudentQuery(event.target.value)}
                placeholder="ابحث باسم الطالب"
                className="pr-9"
              />
            </div>
            <Select value={studentTeacher} onValueChange={setStudentTeacher}>
              <SelectTrigger>
                <SelectValue placeholder="الحلقة عند الربط" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">بدون حلقة</SelectItem>
                {teacherNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-2xl border bg-muted/30 p-2">
              {availableStudents.length === 0 ? (
                <p className="p-5 text-center text-sm text-muted-foreground">
                  لا يوجد طلاب متاحون للربط.
                </p>
              ) : (
                availableStudents.map((student) => (
                  <label
                    key={student.id}
                    className="flex cursor-pointer items-center gap-2 rounded-xl p-2 hover:bg-background"
                  >
                    <Checkbox
                      checked={selectedStudents.has(student.id)}
                      onCheckedChange={() => toggleStudent(student.id)}
                    />
                    <span className="font-semibold">{student.name || "بدون اسم"}</span>
                    <span className="text-xs text-muted-foreground">
                      — {student.teacher || "بدون معلم/ة"}
                    </span>
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">المحدد: {selectedStudents.size} طالب</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStudentsOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={() => void addStudentsToYear()} disabled={selectedStudents.size === 0}>
              ربط الطلاب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Halaqat;
