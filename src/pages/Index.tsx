import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompetitionTable } from "@/components/CompetitionTable";
import { ImportExport } from "@/components/ImportExport";
import { NotificationSystem } from "@/components/notifications/NotificationSystem";
import { InstallPrompt } from "@/components/InstallPrompt";
import { RecallStudents } from "@/components/RecallStudents";
import { Plus, Printer, Trash2, Calendar, LogOut, Save, Camera, Wifi, WifiOff, RefreshCw, Users, Award, HeartHandshake, Receipt, ScrollText, Sparkles, Trophy, BookOpenCheck, WalletCards, Search, CalendarDays } from "lucide-react";
import logo from "@/assets/logo.png";
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
  syncToCloud,
  syncFromCloud,
  mergeDuplicateStudents,
  loadTeachers as loadCachedTeachers,
  registerStudentInYear,
} from "@/utils/storage";
import { getPendingChanges } from "@/utils/localDB";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";

interface DirtyData {
  name: string;
  teacher: string;
  history: HifzHistory;
  yearData: YearData;
}

const Index = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentYear, setCurrentYear] = useState<string>("1447");
  const [competitionType, setCompetitionType] = useState<'ramadan' | 'dhul_hijjah'>(
    () => (localStorage.getItem('competitionType') as 'ramadan' | 'dhul_hijjah') || 'ramadan'
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; label?: string } | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [dirtyMap, setDirtyMap] = useState<Record<number, DirtyData>>({});
  const [teacherNames, setTeacherNames] = useState<string[]>([]);
  const { toast } = useToast();
  const { user, signOut } = useAuth();

  const isDirty = Object.keys(dirtyMap).length > 0;

  // مفتاح البيانات الفعلي المستخدم للتخزين: يضيف لاحقة D لبيانات مسابقة عشر ذي الحجة
  // حتى تبقى منفصلة تماماً عن بيانات المسابقة الرمضانية لنفس العام، دون أي تعديل بقاعدة البيانات
  const dataYearKey = competitionType === 'dhul_hijjah' ? `${currentYear}D` : currentYear;
  const competitionLabel = competitionType === 'dhul_hijjah' ? 'مسابقة عشر ذي الحجة' : 'المسابقة الرمضانية';

  const loadData = useCallback(async () => {
    setLoading(true);
    const studentsWithData = await loadAllStudentsWithData(dataYearKey);
    setStudents(studentsWithData);
    setDirtyMap({});
    setLoading(false);
  }, [dataYearKey]);

  const loadTeachers = useCallback(async () => {
    if (!user) { setTeacherNames([]); return; }
    const data = await loadCachedTeachers(currentYear);
    setTeacherNames(data.map((r) => r.name));
  }, [user, currentYear]);

  useEffect(() => { void loadTeachers(); }, [loadTeachers]);

  // Merge dropdown: registered teachers + teachers already used by students this year
  const mergedTeacherNames = (() => {
    const set = new Set<string>(teacherNames);
    for (const s of students) {
      const t = (s.teacher || "").trim();
      if (t) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ar"));
  })();
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') void loadTeachers(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', loadTeachers);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', loadTeachers);
    };
  }, [loadTeachers]);

  // Auto-sync queued offline changes
  const autoSyncPending = useCallback(async () => {
    if (!navigator.onLine || !user) return;
    try {
      const pending = await getPendingChanges();
      if (pending.length === 0) return;
      setSyncProgress({ current: 0, total: pending.length + 1, label: 'مزامنة العمليات المعلقة' });
      const ok = await syncToCloud((current, total, label) =>
        setSyncProgress({ current, total, label })
      );
      setSyncProgress(null);
      if (ok) {
        toast({
          title: 'تمت المزامنة',
          description: `تم رفع ${pending.length} عملية معلقة إلى السحابة`,
        });
        await loadData();
      }
    } catch (e) {
      setSyncProgress(null);
      console.error('Auto-sync error:', e);
    }
  }, [user, loadData, toast]);

  // Track online/offline + auto-sync triggers
  // (خفّفنا هنا: كانت المزامنة تحصل عند كل عودة للتطبيق وكل 60 ثانية،
  // وهذا كان يُثقل التصفح خصوصاً بشبكة ضعيفة. الآن: فقط عند فتح التطبيق
  // أول مرة، وعند عودة الاتصال بعد انقطاعه — وباقي الوقت المزامنة تصير
  // يدوياً (زر مزامنة) أو تلقائياً عند محاولة الخروج من التطبيق.)
  useEffect(() => {
    const goOnline = () => { setOnline(true); void autoSyncPending(); };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    void autoSyncPending();
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [autoSyncPending]);

  useEffect(() => {
    const init = async () => {
      const year = await getActiveYear();
      setCurrentYear(year);
      // Auto-remove duplicate students silently on startup
      try {
        const merged = await mergeDuplicateStudents();
        if (merged > 0 && navigator.onLine) {
          await syncToCloud();
        }
      } catch (e) {
        console.error('Auto-merge failed:', e);
      }
    };
    init();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // حماية الخروج (بالمتصفح فقط حالياً): تحذير عند إغلاق التبويب إذا فيه
  // بيانات لم تُزامَن مع السحابة بعد. (ميزة زر الرجوع بأندرويد أُزيلت مؤقتاً
  // لأنها سببت تعطل التطبيق عند الفتح — سنعيدها لاحقاً بطريقة أضمن)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  const handleDirtyChange = useCallback((studentId: number, data: DirtyData) => {
    setDirtyMap(prev => ({ ...prev, [studentId]: data }));
  }, []);

  const handleSaveAll = async () => {
    if (!isDirty) return;

    // Prevent duplicate student names (case-insensitive, trimmed)
    const norm = (s: string) => (s || '').trim().replace(/\s+/g, ' ');
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
    const dupNames = Object.entries(counts).filter(([, ids]) => ids.length > 1).map(([k]) => k);
    if (dupNames.length > 0) {
      toast({
        title: "أسماء مكررة",
        description: `يوجد تكرار في: ${dupNames.join('، ')}. الرجاء تعديل الأسماء قبل الحفظ.`,
        variant: "destructive",
      });
      return;
    }

    // فحص إضافي: هل أي اسم بالتغييرات الجديدة موجود مسبقاً بعام سابق
    // (طالبة أخرى بنفس الاسم بالنظام)؟ يمنع إنشاء طالبة مكررة بالغلط
    // بدل استخدام "استدعاء طالبة من الأعوام السابقة"
    const { checkGlobalDuplicateName } = await import("@/utils/storage");
    for (const [idStr, data] of Object.entries(dirtyMap)) {
      const trimmedName = norm(data.name);
      if (!trimmedName) continue;
      const dup = await checkGlobalDuplicateName(trimmedName, parseInt(idStr));
      if (dup && dup.years.length > 0) {
        setDuplicateWarning({ name: trimmedName, years: dup.years });
        return;
      }
    }

    setSaving(true);

    try {
      const entries = Object.entries(dirtyMap);
      await Promise.all(entries.map(async ([idStr, data]) => {
        const id = parseInt(idStr);
        await saveStudent({ id, name: data.name, teacher: data.teacher });
        await saveHifzHistory(id, data.history);
        await saveYearData(dataYearKey, id, data.yearData);
      }));

      setDirtyMap({});

      // Sync to cloud with progress
      setSyncProgress({ current: 0, total: 1, label: 'بدء الرفع' });
      const synced = await syncToCloud((current, total, label) =>
        setSyncProgress({ current, total, label })
      );
      setSyncProgress(null);

      await loadData();

      toast({
        title: "تم الحفظ",
        description: synced
          ? `تم حفظ ومزامنة بيانات ${entries.length} طالبة بنجاح`
          : `تم الحفظ محلياً (${entries.length} طالبة) - سيتم المزامنة عند الاتصال بالإنترنت`,
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "خطأ في الحفظ",
        description: "حدث خطأ أثناء حفظ البيانات، حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleYearChange = async (year: string) => {
    if (isDirty && !confirm('هناك تغييرات غير محفوظة، هل تريد المتابعة بدون حفظ؟')) return;

    // ترحيل بيانات المسابقة الرمضانية فقط (أساس الحفظ التراكمي يُبنى عليها)
    const globalStudents = await loadGlobalStudents();
    await migrateYearData(year, globalStudents);
    
    setCurrentYear(year);
    await setActiveYear(year);
    toast({
      title: "تم تغيير السنة",
      description: `تم التبديل إلى عام ${year}هـ`,
    });
  };

  const handleCompetitionTypeChange = (type: 'ramadan' | 'dhul_hijjah') => {
    if (isDirty && !confirm('هناك تغييرات غير محفوظة، هل تريد المتابعة بدون حفظ؟')) return;
    setCompetitionType(type);
    localStorage.setItem('competitionType', type);
    toast({
      title: "تم التبديل",
      description: type === 'dhul_hijjah' ? "تم التبديل إلى مسابقة عشر ذي الحجة" : "تم التبديل إلى المسابقة الرمضانية",
    });
  };

  const addNewStudent = async () => {
    if (isDirty) {
      await handleSaveAll();
      if (Object.keys(dirtyMap).length > 0) return; // save blocked (duplicates)
    }
    const newId = await saveStudent({ name: '', teacher: '' });
    if (newId) {
      await registerStudentInYear(dataYearKey, newId);
      await loadData();
      toast({
        title: "تمت الإضافة",
        description: "تم إضافة طالبة جديدة",
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه الطالبة؟')) return;

    const { deleteStudent } = await import("@/utils/storage");
    await deleteStudent(id);
    
    setDirtyMap(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    await loadData();
    toast({
      title: "تم الحذف",
      description: "تم حذف الطالبة بنجاح",
      variant: "destructive",
    });
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{ name: string; years: string[] } | null>(null);
  const [deleteMode, setDeleteMode] = useState<'all' | 'year' | 'selected'>('year');
  const [selectedToDelete, setSelectedToDelete] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const toggleSelectedToDelete = (id: number) => {
    setSelectedToDelete((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      if (deleteMode === 'all') {
        const { deleteAllStudents } = await import("@/utils/storage");
        await deleteAllStudents();
        setStudents([]);
        setDirtyMap({});
        toast({ title: "تم الحذف", description: "تم حذف جميع البيانات (كل الأعوام والطالبات)", variant: "destructive" });
      } else if (deleteMode === 'year') {
        const { deleteYearData } = await import("@/utils/storage");
        await deleteYearData(dataYearKey);
        setDirtyMap({});
        toast({ title: "تم الحذف", description: `تم حذف بيانات ${competitionLabel} لعام ${currentYear}هـ فقط (الطالبات نفسهن باقيات)`, variant: "destructive" });
        await loadData();
      } else {
        if (selectedToDelete.size === 0) { setDeleting(false); return; }
        const { deleteStudents } = await import("@/utils/storage");
        await deleteStudents(Array.from(selectedToDelete));
        setSelectedToDelete(new Set());
        toast({ title: "تم الحذف", description: `تم حذف ${selectedToDelete.size} طالبة بكل بياناتهن`, variant: "destructive" });
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

  const handleSyncFromCloud = async () => {
    if (!online) {
      toast({ title: "لا يوجد اتصال", description: "يرجى الاتصال بالإنترنت أولاً", variant: "destructive" });
      return;
    }
    setSyncing(true);
    setSyncProgress({ current: 0, total: 4, label: 'بدء التنزيل' });
    const success = await syncFromCloud((current, total, label) =>
      setSyncProgress({ current, total, label })
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

  // حساب الترتيب - محلياً فقط بدون حفظ تلقائي
  useEffect(() => {
    const sortedStudents = [...students]
      .filter(s => parseFloat(s.yearData?.total || '0') > 0)
      .sort((a, b) => parseFloat(b.yearData?.total || '0') - parseFloat(a.yearData?.total || '0'));

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
      setStudents(prev => [...prev]);
    }
  }, [students.length, dataYearKey]);

  const now = new Date();
  const currentDate = now.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const dayName = now.toLocaleDateString('ar-EG', { weekday: 'long' });
  const hijriDate = now.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const activeStudents = students.filter(s => {
    const parts = parseFloat(s.yearData?.parts || '0');
    const total = parseFloat(s.yearData?.total || '0');
    return parts > 0 || total > 0;
  }).length;
  const totalParts = students.reduce((sum, s) => sum + (parseFloat(s.yearData?.parts || '0') || 0), 0);
  const totalPrizes = students.reduce((sum, s) => sum + (parseFloat(s.yearData?.prize || '0') || 0), 0);
  const dirtyCount = Object.keys(dirtyMap).length;

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.16),transparent_34rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)/0.45))]" dir="rtl">
      <InstallPrompt />

      <header className="relative isolate px-4 pb-8 pt-4 text-primary-foreground print:bg-primary print:py-4">
        <div className="pointer-events-none absolute inset-x-3 inset-y-3 -z-10 rounded-[2rem] bg-gradient-to-br from-primary via-emerald-700 to-teal-950 shadow-2xl shadow-primary/20 print:rounded-none" />
        <div className="pointer-events-none absolute inset-x-3 inset-y-3 -z-10 rounded-[2rem] bg-[radial-gradient(circle_at_18%_16%,rgba(255,255,255,.18),transparent_13rem)] print:hidden" />

        <div className="container relative z-10 mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-3xl bg-white/95 p-2 shadow-xl shadow-black/10 ring-1 ring-white/40">
                <img src={logo} alt="مركز إنماء الأهلي الخيري" className="h-16 w-16 object-contain sm:h-20 sm:w-20 print:h-16 print:w-16" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs text-white/90 ring-1 ring-white/15">
                  <Sparkles className="h-3.5 w-3.5 text-islamic-gold" />
                  نظام إدارة المسابقة
                </div>
                <p className="mt-3 text-lg font-black leading-relaxed text-islamic-gold drop-shadow-sm sm:text-2xl">
                  بسم الله الرحمن الرحيم
                </p>
                <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-4xl">
                  كشف {competitionLabel}
                </h1>
                <p className="mt-1 text-sm text-white/75 sm:text-base">مركز إنماء الأهلي الخيري · الإشراف - شرعب الرونة</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-3xl bg-white/10 p-3 text-sm text-white/85 ring-1 ring-white/15 backdrop-blur sm:min-w-52">
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold">{dayName}</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${online ? 'bg-emerald-300/20 text-emerald-50' : 'bg-red-300/20 text-red-50'}`}>
                  {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                  {online ? 'متصل' : 'غير متصل'}
                </span>
              </div>
              <div>{hijriDate}</div>
              <div>{currentDate}</div>
              <Button
                onClick={signOut}
                variant="ghost"
                size="sm"
                className="mt-1 justify-center gap-1 rounded-full text-white/80 hover:bg-white/10 hover:text-white print:hidden"
              >
                <LogOut className="h-3 w-3" />
                خروج
              </Button>
            </div>
          </div>

          <div className="grid gap-3 pb-2 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
            <div className="rounded-3xl bg-white/14 p-4 ring-1 ring-white/15 backdrop-blur">
              <Users className="mb-3 h-6 w-6 text-islamic-gold" />
              <div className="text-3xl font-black">{students.length}</div>
              <div className="text-sm text-white/70">إجمالي الطالبات</div>
            </div>
            <div className="rounded-3xl bg-white/14 p-4 ring-1 ring-white/15 backdrop-blur">
              <Trophy className="mb-3 h-6 w-6 text-islamic-gold" />
              <div className="text-3xl font-black">{activeStudents}</div>
              <div className="text-sm text-white/70">طالبات نشطات</div>
            </div>
            <div className="rounded-3xl bg-white/14 p-4 ring-1 ring-white/15 backdrop-blur">
              <BookOpenCheck className="mb-3 h-6 w-6 text-islamic-gold" />
              <div className="text-3xl font-black">{totalParts.toLocaleString('ar-EG')}</div>
              <div className="text-sm text-white/70">أجزاء محفوظة هذا العام</div>
            </div>
            <div className="rounded-3xl bg-white/14 p-4 ring-1 ring-white/15 backdrop-blur">
              <WalletCards className="mb-3 h-6 w-6 text-islamic-gold" />
              <div className="text-3xl font-black">{totalPrizes.toLocaleString('ar-EG')}</div>
              <div className="text-sm text-white/70">إجمالي المكافآت</div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-7 print:p-0">
      <div className="print:hidden space-y-4">
        <NotificationSystem students={students} currentYear={currentYear} />
        <ImportExport onDataImported={loadData} currentYear={dataYearKey} displayYear={`${currentYear}${competitionType === 'dhul_hijjah' ? ' - ذو الحجة' : ''}`} />

        <div className="rounded-[1.75rem] border border-white/70 bg-card/88 p-4 shadow-xl shadow-primary/5 backdrop-blur sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-foreground sm:text-xl">لوحة التحكم</h2>
              <p className="text-sm text-muted-foreground">تنقّل سريع وإدارة بيانات عام {currentYear}هـ · {competitionLabel}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-2xl bg-secondary p-1 ring-1 ring-primary/10 print:hidden">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleCompetitionTypeChange('ramadan')}
                  className={`h-8 rounded-xl px-3 text-xs font-bold ${competitionType === 'ramadan' ? 'bg-primary text-primary-foreground shadow' : 'bg-transparent text-muted-foreground hover:bg-white/60'}`}
                >
                  المسابقة الرمضانية
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleCompetitionTypeChange('dhul_hijjah')}
                  className={`h-8 rounded-xl px-3 text-xs font-bold ${competitionType === 'dhul_hijjah' ? 'bg-primary text-primary-foreground shadow' : 'bg-transparent text-muted-foreground hover:bg-white/60'}`}
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
                    {Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i).map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}هـ
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <Link to="/teachers" className="w-full sm:w-auto">
              <Button className="h-20 w-full flex-col gap-2 rounded-2xl bg-primary/95 shadow-lg shadow-primary/20 hover:-translate-y-0.5 hover:bg-primary">
                <Users className="h-5 w-5" />
                <span>المعلمات</span>
              </Button>
            </Link>
            <Link to="/awards" className="w-full sm:w-auto">
              <Button className="h-20 w-full flex-col gap-2 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:-translate-y-0.5 hover:bg-amber-600">
                <Award className="h-5 w-5" />
                <span>الجوائز</span>
              </Button>
            </Link>
            <Link to="/donors" className="w-full sm:w-auto">
              <Button className="h-20 w-full flex-col gap-2 rounded-2xl border border-primary/10 bg-background text-foreground shadow-sm hover:-translate-y-0.5 hover:bg-secondary" variant="secondary">
                <HeartHandshake className="h-5 w-5 text-primary" />
                <span>الداعمون</span>
              </Button>
            </Link>
            <Link to="/expenses" className="w-full sm:w-auto">
              <Button className="h-20 w-full flex-col gap-2 rounded-2xl border border-primary/10 bg-background text-foreground shadow-sm hover:-translate-y-0.5 hover:bg-secondary" variant="secondary">
                <Receipt className="h-5 w-5 text-primary" />
                <span>المصروفات</span>
              </Button>
            </Link>
            <Link to="/search" className="col-span-2 w-full md:col-span-1 sm:w-auto">
              <Button className="h-20 w-full flex-col gap-2 rounded-2xl border border-primary/10 bg-background text-foreground shadow-sm hover:-translate-y-0.5 hover:bg-secondary" variant="secondary">
                <Search className="h-5 w-5 text-primary" />
                <span>بحث طالبة</span>
              </Button>
            </Link>
            <Link to="/certificates" className="col-span-2 w-full md:col-span-1 sm:w-auto">
              <Button className="h-20 w-full flex-col gap-2 rounded-2xl border border-primary/10 bg-background text-foreground shadow-sm hover:-translate-y-0.5 hover:bg-secondary" variant="secondary">
                <ScrollText className="h-5 w-5 text-primary" />
                <span>الشهادات</span>
              </Button>
            </Link>
            <Link to="/monthly" className="w-full sm:w-auto">
              <Button className="h-20 w-full flex-col gap-2 rounded-2xl bg-gradient-to-l from-amber-400 via-amber-500 to-primary text-white shadow-lg shadow-amber-400/25 hover:-translate-y-0.5">
                <Sparkles className="h-5 w-5" />
                <span>المتابعة الشهرية</span>
              </Button>
            </Link>
            <Link to="/khatimat" className="w-full sm:w-auto">
              <Button className="h-20 w-full flex-col gap-2 rounded-2xl border border-primary/10 bg-background text-foreground shadow-sm hover:-translate-y-0.5 hover:bg-secondary" variant="secondary">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <span>كشف الخاتمات</span>
              </Button>
            </Link>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <Button onClick={addNewStudent} className="h-12 gap-2 rounded-2xl lg:col-span-2">
              <Plus className="h-4 w-4" />
              إضافة طالبة جديدة
            </Button>

            <Button
              onClick={handleSaveAll}
              disabled={!isDirty || saving}
              className={`h-12 gap-2 rounded-2xl lg:col-span-2 ${isDirty ? 'bg-emerald-600 shadow-lg shadow-emerald-600/25 hover:bg-emerald-700' : ''}`}
            >
              <Save className="h-4 w-4" />
              {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
              {isDirty && <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{dirtyCount}</span>}
            </Button>

            <RecallStudents currentYear={currentYear} onRecalled={loadData} />

            <Button onClick={handlePrint} variant="secondary" className="h-12 gap-2 rounded-2xl">
              <Printer className="h-4 w-4" />
              طباعة
            </Button>

            <Link to="/media">
              <Button variant="outline" className="h-12 w-full gap-2 rounded-2xl">
                <Camera className="h-4 w-4" />
                الوسائط
              </Button>
            </Link>

            <Button
              onClick={handleSyncFromCloud}
              disabled={syncing || !online}
              variant="outline"
              className="h-12 gap-2 rounded-2xl lg:col-span-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncProgress ? `${syncProgress.current}/${syncProgress.total}` : 'مزامنة'}
            </Button>

            <Button
              onClick={() => { setDeleteMode('year'); setSelectedToDelete(new Set()); setDeleteDialogOpen(true); }}
              variant="destructive"
              className="h-12 gap-2 rounded-2xl lg:col-span-2"
            >
              <Trash2 className="h-4 w-4" />
              حذف بيانات
            </Button>
          </div>

          {syncProgress && (
            <div className="mt-2 space-y-1">
              <Progress value={(syncProgress.current / Math.max(syncProgress.total, 1)) * 100} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {syncProgress.label || 'جارٍ المزامنة'}: {syncProgress.current} / {syncProgress.total}
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

      <footer className="px-4 pb-8 text-center text-sm text-muted-foreground print:py-2">
        تصميم أ/ مختار الكمالي
      </footer>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { font-size: 11px; }
          @page { size: landscape; margin: 10mm; }
        }
      `}</style>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-destructive">حذف بيانات</DialogTitle>
          </DialogHeader>

          <RadioGroup value={deleteMode} onValueChange={(v) => setDeleteMode(v as typeof deleteMode)} className="space-y-3">
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 hover:bg-secondary/50">
              <RadioGroupItem value="year" id="mode-year" className="mt-1" />
              <div>
                <div className="font-bold">حذف بيانات {competitionLabel} لعام {currentYear}هـ فقط</div>
                <div className="text-xs text-muted-foreground">تُحذف الدرجات والحفظ لهذا العام فقط، وتبقى الطالبات وباقي الأعوام كما هي</div>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 hover:bg-secondary/50">
              <RadioGroupItem value="selected" id="mode-selected" className="mt-1" />
              <div className="w-full">
                <div className="font-bold">حذف طالبات محددات</div>
                <div className="text-xs text-muted-foreground">تُحذف الطالبات المختارات بكل بياناتهن من كل الأعوام</div>
                {deleteMode === 'selected' && (
                  <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg bg-secondary/40 p-2">
                    {students.length === 0 ? (
                      <p className="p-2 text-xs text-muted-foreground">لا توجد طالبات بهذا العام</p>
                    ) : students.map((s) => (
                      <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 hover:bg-background">
                        <Checkbox
                          checked={selectedToDelete.has(s.id)}
                          onCheckedChange={() => toggleSelectedToDelete(s.id)}
                        />
                        <span className="text-sm">{s.name || "بدون اسم"} <span className="text-xs text-muted-foreground">— {s.teacher}</span></span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 hover:bg-destructive/10">
              <RadioGroupItem value="all" id="mode-all" className="mt-1" />
              <div>
                <div className="font-bold text-destructive">حذف كل البيانات نهائياً</div>
                <div className="text-xs text-muted-foreground">تُحذف كل الطالبات وكل الأعوام والمتابعات — إجراء لا يمكن التراجع عنه</div>
              </div>
            </label>
          </RadioGroup>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>إلغاء</Button>
            <Button
              variant="destructive"
              disabled={deleting || (deleteMode === 'selected' && selectedToDelete.size === 0)}
              onClick={handleConfirmDelete}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "جارٍ الحذف..." : "تأكيد الحذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!duplicateWarning} onOpenChange={(open) => !open && setDuplicateWarning(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ هذه الطالبة مسجّلة مسبقاً</AlertDialogTitle>
            <AlertDialogDescription>
              الاسم <strong>"{duplicateWarning?.name}"</strong> موجود بالفعل بالنظام بـ
              {duplicateWarning?.years.length === 1 ? " عام " : " أعوام "}
              <strong>{duplicateWarning?.years.map((y) => `${y}هـ`).join('، ')}</strong>.
              <br /><br />
              لتفادي إنشاء سجل مكرر، استخدم زر <strong>"استدعاء طالبة من الأعوام السابقة"</strong> بدل إضافتها
              كطالبة جديدة، أو صحّح الاسم لو كانت طالبة مختلفة فعلاً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDuplicateWarning(null)}>حسناً، فهمت</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;

