import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InstallPrompt } from "@/components/InstallPrompt";
import { AppSidebar } from "@/components/AppSidebar";
import { StudentsTable } from "@/components/StudentsTable";
import { StudentProfileModal } from "@/components/StudentProfileModal";
import {
  Plus,
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
  Download,
  Printer,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { Student, START_YEAR, END_YEAR } from "@/types/student";
import {
  loadGlobalStudents,
  getActiveYear,
  setActiveYear,
  syncToCloud,
  syncFromCloud,
  saveStudent,
  loadTeachers,
} from "@/utils/storage";
import { getPendingChanges } from "@/utils/localDB";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Progress } from "@/components/ui/progress";

const Index = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentYear, setCurrentYear] = useState<string>("1447");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; label?: string } | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [teacherNames, setTeacherNames] = useState<string[]>([]);
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<Student | null>(null);

  const { toast } = useToast();
  const { user, signOut } = useAuth();

  const loadData = useCallback(async () => {
    setLoading(true);
    const [allStudents, teachers] = await Promise.all([
      loadGlobalStudents(),
      loadTeachers(currentYear),
    ]);
    setStudents(allStudents);
    setTeacherNames(teachers.map((t) => t.name));
    setLoading(false);
  }, [currentYear]);

  // Auto-sync queued offline changes
  const autoSyncPending = useCallback(async () => {
    if (!navigator.onLine || !user) return;
    try {
      const pending = await getPendingChanges();
      if (pending.length === 0) return;
      setSyncProgress({ current: 0, total: pending.length + 1, label: "مزامنة العمليات المعلقة" });
      const ok = await syncToCloud((current, total, label) =>
        setSyncProgress({ current, total, label })
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
      toast({ title: "لا يوجد اتصال", description: "يرجى الاتصال بالإنترنت أولاً", variant: "destructive" });
      return;
    }
    setSyncing(true);
    setSyncProgress({ current: 0, total: 4, label: "بدء التنزيل" });
    const success = await syncFromCloud((current, total, label) =>
      setSyncProgress({ current, total, label })
    );
    setSyncProgress(null);
    if (success) {
      await loadData();
      toast({ title: "تمت المزامنة", description: "تم تحديث البيانات من السحابة بنجاح" });
    } else {
      toast({ title: "خطأ", description: "فشل في المزامنة", variant: "destructive" });
    }
    setSyncing(false);
  };

  const now = new Date();
  const currentDate = now.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const dayName = now.toLocaleDateString("ar-EG", { weekday: "long" });
  const hijriDate = now.toLocaleDateString("ar-SA-u-ca-islamic-umalqura", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Calculate stats
  const totalStudents = students.length;
  const orphansOrSpecialCount = students.filter(
    (s) => s.status && s.status !== "مستمر" && s.status !== "منتظم"
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

      {/* Main Layout with Right Vertical Sidebar */}
      <div className="flex min-h-screen w-full">
        {/* Right Vertical Sidebar */}
        <AppSidebar currentYear={currentYear} />

        {/* Content Area */}
        <div className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
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
                      السجل الرسمي الموحد لجميع طلاب الحلقات والمسابقات القرآنية · الإشراف - شرعب الرونة
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 rounded-3xl bg-white/10 p-3 text-xs text-white/85 ring-1 ring-white/15 backdrop-blur sm:min-w-56 sm:text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-semibold">{dayName}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                        online
                          ? "bg-emerald-300/20 text-emerald-50"
                          : "bg-red-300/20 text-red-50"
                      }`}
                    >
                      {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
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
                          {Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i).map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}هـ</SelectItem>
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
                  جدول بيانات الطلاب الرسمي
                </h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {students.length} طالب
                </span>
              </div>

              <div className="flex items-center gap-2">
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

            {syncProgress && (
              <div className="space-y-1">
                <Progress value={(syncProgress.current / Math.max(syncProgress.total, 1)) * 100} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">
                  {syncProgress.label || "جارٍ المزامنة"}: {syncProgress.current} / {syncProgress.total}
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
                currentYear={currentYear}
                teacherNames={teacherNames}
                onRefresh={loadData}
                onSelectStudentForProfile={(s) => setSelectedStudentForProfile(s)}
              />
            )}
          </main>

          {/* Footer */}
          <footer className="mt-auto px-4 py-6 text-center text-xs text-muted-foreground">
            مركز إنماء الأهلي الخيري - قسم القرآن الكريم · تصميم أ/ مختار الكمالي
          </footer>
        </div>
      </div>

      {/* Student Profile Modal */}
      {selectedStudentForProfile && (
        <StudentProfileModal
          student={selectedStudentForProfile}
          initialYear={currentYear}
          open={!!selectedStudentForProfile}
          onOpenChange={(open) => {
            if (!open) setSelectedStudentForProfile(null);
          }}
          onStudentUpdated={loadData}
        />
      )}
    </div>
  );
};

export default Index;
