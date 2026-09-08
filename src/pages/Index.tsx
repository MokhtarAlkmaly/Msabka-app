import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompetitionTable } from "@/components/CompetitionTable";
import { ImportExport } from "@/components/ImportExport";
import { NotificationSystem } from "@/components/notifications/NotificationSystem";
import { InstallPrompt } from "@/components/InstallPrompt";
import { RecallStudents } from "@/components/RecallStudents";
import { Plus, Printer, Trash2, Calendar, Save, Camera, Users, Award, HeartHandshake, Receipt, ScrollText, Sparkles, Trophy, BookOpenCheck, WalletCards, Search, Upload } from "lucide-react";
import logo from "@/assets/logo.png";
import { Student, HifzHistory, YearData, START_YEAR, END_YEAR } from "@/types/student";
import {
  loadAllStudentsWithData,
  loadGlobalStudents,
  saveStudent,
  deleteAllStudents,
  getActiveYear,
  setActiveYear,
  saveHifzHistory,
  saveYearData,
  migrateYearData,
  mergeDuplicateStudents,
  loadTeachers as loadCachedTeachers,
  registerStudentInYear,
  importFullBackupFromFile,
} from "@/utils/storage";
import { useToast } from "@/hooks/use-toast";

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
  const [restoringBackup, setRestoringBackup] = useState(false);
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const [dirtyMap, setDirtyMap] = useState<Record<number, DirtyData>>({});
  const [teacherNames, setTeacherNames] = useState<string[]>([]);
  const { toast } = useToast();

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
    const data = await loadCachedTeachers(currentYear);
    setTeacherNames(data.map((r) => r.name));
  }, [currentYear]);

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

  useEffect(() => {
    const init = async () => {
      const year = await getActiveYear();
      setCurrentYear(year);
      // Auto-remove duplicate students silently on startup
      try {
        await mergeDuplicateStudents();
      } catch (e) {
        console.error('Auto-merge failed:', e);
      }
    };
    init();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      await loadData();

      toast({
        title: "تم الحفظ",
        description: `تم حفظ بيانات ${entries.length} طالبة محلياً على هذا الجهاز`,
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

  // حماية الخروج: تحذير عند محاولة إغلاق التطبيق (زر الرجوع بأندرويد)
  // أو إغلاق التبويب بالمتصفح إذا فيه تعديلات محلية لم تُحفظ بعد
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    let removeBackListener: (() => void) | undefined;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("backButton", async (event) => {
          if (event.canGoBack) return; // تنقّل عادي داخل التطبيق، اتركه كما هو

          if (!isDirty) {
            App.exitApp();
            return;
          }

          const wantsSave = window.confirm(
            "عندك تعديلات لم تُحفظ بعد. هل تريد حفظها الآن قبل الخروج؟\n\nموافق = حفظ ثم خروج\nإلغاء = خروج بدون حفظ"
          );
          if (wantsSave) {
            try {
              await handleSaveAll();
            } catch (e) {
              console.error("Save before exit failed:", e);
            }
          }
          App.exitApp();
        });
        removeBackListener = () => listener.remove();
      } catch (e) {
        console.error("Back button guard setup failed:", e);
      }
    })();

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      removeBackListener?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

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

  const handleReset = async () => {
    if (!confirm('هل أنت متأكد من حذف جميع البيانات؟ هذا الإجراء لا يمكن التراجع عنه!')) return;

    await deleteAllStudents();
    setStudents([]);
    setDirtyMap({});
    
    toast({
      title: "تم الحذف",
      description: "تم حذف جميع البيانات",
      variant: "destructive",
    });
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setRestoringBackup(true);
    try {
      const result = await importFullBackupFromFile(file);
      await loadData();
      toast({
        title: "تم الاستيراد بنجاح",
        description: `طالبات: ${result.students} · معلمات: ${result.teachers} · جوائز: ${result.awards} · وسائط: ${result.media}`,
      });
    } catch (err) {
      console.error("Restore backup failed:", err);
      toast({
        title: "فشل الاستيراد",
        description: "تأكدي أن الملف نسخة احتياطية صحيحة (JSON) وحاولي مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setRestoringBackup(false);
    }
  };

  const handlePrint = async () => {
    const { printCurrentPage } = await import("@/utils/nativePrint");
    printCurrentPage(`كشف_${competitionLabel}_${currentYear}`);
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
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-300/20 px-2 py-1 text-xs text-emerald-50">
                  محفوظ محلياً على هذا الجهاز
                </span>
              </div>
              <div>{hijriDate}</div>
              <div>{currentDate}</div>
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

          <div className="space-y-4">
            {/* مجموعة: إدارة الطالبات */}
            <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-3">
              <p className="mb-2 px-1 text-[11px] font-bold text-violet-700">إدارة الطالبات</p>
              <div className="flex flex-wrap items-center gap-2">
                <Link to="/search">
                  <Button size="sm" variant="outline" className="gap-1.5 rounded-xl border-violet-300 bg-white text-violet-700 hover:bg-violet-100">
                    <Search className="h-3.5 w-3.5" /> بحث طالبة
                  </Button>
                </Link>
                <Button onClick={addNewStudent} size="sm" className="gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700">
                  <Plus className="h-3.5 w-3.5" /> إضافة طالبة
                </Button>
                <RecallStudents currentYear={currentYear} onRecalled={loadData} />
              </div>
            </div>

            {/* مجموعة: المتابعة والتقارير */}
            <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-3">
              <p className="mb-2 px-1 text-[11px] font-bold text-teal-700">المتابعة والتقارير</p>
              <div className="flex flex-wrap items-center gap-2">
                <Link to="/monthly">
                  <Button size="sm" className="relative gap-1.5 overflow-hidden rounded-xl border border-amber-400 bg-gradient-to-l from-amber-400 via-amber-500 to-primary font-bold text-white shadow-sm shadow-amber-400/30">
                    <Sparkles className="h-3 w-3" /> المتابعة الشهرية
                  </Button>
                </Link>
                <Link to="/certificates">
                  <Button size="sm" variant="outline" className="gap-1.5 rounded-xl border-teal-300 bg-white text-teal-700 hover:bg-teal-100">
                    <ScrollText className="h-3.5 w-3.5" /> الشهادات
                  </Button>
                </Link>
                <Link to="/media">
                  <Button size="sm" variant="outline" className="gap-1.5 rounded-xl border-teal-300 bg-white text-teal-700 hover:bg-teal-100">
                    <Camera className="h-3.5 w-3.5" /> الوسائط
                  </Button>
                </Link>
                <Button onClick={handlePrint} size="sm" variant="outline" className="gap-1.5 rounded-xl border-teal-300 bg-white text-teal-700 hover:bg-teal-100">
                  <Printer className="h-3.5 w-3.5" /> طباعة
                </Button>
              </div>
            </div>

            {/* مجموعة: الإدارة المالية والفريق */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
              <p className="mb-2 px-1 text-[11px] font-bold text-amber-700">الإدارة المالية والفريق</p>
              <div className="flex flex-wrap items-center gap-2">
                <Link to="/teachers">
                  <Button size="sm" variant="outline" className="gap-1.5 rounded-xl border-primary/30 bg-white text-primary hover:bg-primary/10">
                    <Users className="h-3.5 w-3.5" /> المعلمات
                  </Button>
                </Link>
                <Link to="/awards">
                  <Button size="sm" variant="outline" className="gap-1.5 rounded-xl border-amber-300 bg-white text-amber-700 hover:bg-amber-100">
                    <Award className="h-3.5 w-3.5" /> الجوائز
                  </Button>
                </Link>
                <Link to="/donors">
                  <Button size="sm" variant="outline" className="gap-1.5 rounded-xl border-rose-300 bg-white text-rose-700 hover:bg-rose-100">
                    <HeartHandshake className="h-3.5 w-3.5" /> الداعمون
                  </Button>
                </Link>
                <Link to="/expenses">
                  <Button size="sm" variant="outline" className="gap-1.5 rounded-xl border-sky-300 bg-white text-sky-700 hover:bg-sky-100">
                    <Receipt className="h-3.5 w-3.5" /> المصروفات
                  </Button>
                </Link>
              </div>
            </div>

            {/* مجموعة: حفظ + خطر */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="mb-2 px-1 text-[11px] font-bold text-emerald-700">حفظ الجدول الحالي محلياً</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleSaveAll}
                  disabled={!isDirty || saving}
                  size="sm"
                  className={`gap-1.5 rounded-xl ${isDirty ? "bg-emerald-600 shadow-md shadow-emerald-600/25 hover:bg-emerald-700" : "bg-emerald-600/60"}`}
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
                  {isDirty && <span className="rounded-full bg-white/20 px-1.5 text-[10px]">{dirtyCount}</span>}
                </Button>

                <Button
                  onClick={handleReset}
                  size="sm"
                  variant="destructive"
                  className="mr-auto gap-1.5 rounded-xl opacity-80 hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف جميع البيانات
                </Button>
              </div>
            </div>

            {/* مجموعة: استعادة نسخة احتياطية من النسخة القديمة (IndexedDB) */}
            <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-3">
              <p className="mb-2 px-1 text-[11px] font-bold text-sky-700">
                استيراد بياناتك من النسخة القديمة
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={backupFileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleRestoreBackup}
                  className="hidden"
                />
                <Button
                  onClick={() => backupFileInputRef.current?.click()}
                  disabled={restoringBackup}
                  size="sm"
                  className="gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {restoringBackup ? "جارٍ الاستيراد..." : "استيراد نسخة احتياطية (JSON)"}
                </Button>
              </div>
            </div>
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
    </div>
  );
};

export default Index;

