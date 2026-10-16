import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.png";
import { OfflineNotice } from "@/components/OfflineBadge";
import { BRAND_LOCAL_NOTE, BRAND_NAME_TAGGED } from "@/lib/brand";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Columns3,
  Database,
  Plus,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  Shield,
  Trash2,
  UserCog,
  UsersRound,
} from "lucide-react";
import {
  getActiveYear,
  loadCustomColumns,
  loadStudentStatuses,
  saveCustomColumns,
  saveStudentStatuses,
  setActiveYear,
  loadAllStudentsWithData,
  deleteFullYearData,
  deleteStudentsFromYear,
  deleteEntireDatabase,
} from "@/utils/storage";
import { getMyProfile, updateMyDisplayName } from "@/utils/users";
import { CustomColumnDef, DEFAULT_STATUSES, END_YEAR, START_YEAR } from "@/types/student";

const getErrorMessage = (error: unknown) => {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : "";
};

const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `col-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const columnTypeLabels: Record<NonNullable<CustomColumnDef["type"]>, string> = {
  text: "نص",
  number: "رقم",
  date: "تاريخ",
  phone: "هاتف",
};

const years = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);

const Settings = () => {
  const { toast } = useToast();
  const { user, isAdmin, viewAs, refreshAccess } = useAuth();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingYear, setSavingYear] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState(user?.email || "");
  const [currentYear, setCurrentYear] = useState(String(START_YEAR));
  const [statuses, setStatuses] = useState<string[]>(DEFAULT_STATUSES);
  const [newStatus, setNewStatus] = useState("");
  const [columns, setColumns] = useState<CustomColumnDef[]>([]);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState<NonNullable<CustomColumnDef["type"]>>("text");
  const [advancedDeleteOpen, setAdvancedDeleteOpen] = useState(false);
  const [advancedDeleteMode, setAdvancedDeleteMode] = useState<"year" | "students" | "database">(
    "year",
  );
  const [advancedDeleteYear, setAdvancedDeleteYear] = useState(String(START_YEAR));
  const [yearStudents, setYearStudents] = useState<import("@/types/student").Student[]>([]);
  const [selectedYearStudents, setSelectedYearStudents] = useState<Set<number>>(new Set());
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingAdvanced, setDeletingAdvanced] = useState(false);

  const readOnly = !!viewAs;

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [year, loadedStatuses, loadedColumns, profile] = await Promise.all([
        getActiveYear(),
        loadStudentStatuses(),
        loadCustomColumns(),
        getMyProfile().catch(() => null),
      ]);

      setCurrentYear(year);
      setStatuses(loadedStatuses);
      setColumns(loadedColumns);
      setProfileName(
        profile?.display_name ||
          (typeof user?.user_metadata?.display_name === "string"
            ? user.user_metadata.display_name
            : "") ||
          user?.email?.split("@")[0] ||
          "",
      );
      setProfileEmail(profile?.email || user?.email || "");
    } catch (error: unknown) {
      console.error("تعذّر تحميل الإعدادات:", error);
      toast({
        title: "تعذّر تحميل الإعدادات",
        description: getErrorMessage(error) || "حاول تحديث الصفحة أو تحقق من الاتصال.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user?.email, user?.user_metadata]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!advancedDeleteOpen || advancedDeleteMode !== "students") return;
    let cancelled = false;
    void loadAllStudentsWithData(advancedDeleteYear).then((students) => {
      if (!cancelled) {
        setYearStudents(students);
        setSelectedYearStudents(new Set());
      }
    });
    return () => {
      cancelled = true;
    };
  }, [advancedDeleteOpen, advancedDeleteMode, advancedDeleteYear]);

  const settingsSummary = useMemo(
    () => [
      { label: "العام النشط", value: `${currentYear}هـ`, icon: CalendarDays },
      { label: "حالات الطلاب", value: statuses.length, icon: CheckCircle2 },
      { label: "أعمدة مخصصة", value: columns.length, icon: Columns3 },
    ],
    [columns.length, currentYear, statuses.length],
  );

  const saveProfile = async () => {
    const nextName = profileName.trim();
    if (!nextName) {
      toast({
        title: "الاسم مطلوب",
        description: "اكتب الاسم الظاهر للحساب قبل الحفظ.",
        variant: "destructive",
      });
      return;
    }

    setSavingProfile(true);
    try {
      await updateMyDisplayName(nextName);
      await refreshAccess();
      toast({ title: "تم حفظ الملف الشخصي", description: "تم تحديث الاسم الظاهر بنجاح." });
    } catch (error: unknown) {
      toast({
        title: "تعذّر حفظ الملف الشخصي",
        description: getErrorMessage(error) || "تأكد من تنفيذ ترحيل نظام المستخدمين في Supabase.",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const saveYear = async (year: string) => {
    setCurrentYear(year);
    setSavingYear(true);
    try {
      await setActiveYear(year);
      toast({ title: "تم تغيير العام النشط", description: `سيُفتح النظام على عام ${year}هـ.` });
    } catch (error: unknown) {
      toast({
        title: "تعذّر حفظ العام",
        description: getErrorMessage(error) || "حاول مرة أخرى.",
        variant: "destructive",
      });
    } finally {
      setSavingYear(false);
    }
  };

  const persistStatuses = async (next: string[], message = "تم حفظ حالات الطلاب") => {
    const normalized = Array.from(new Set(next.map((status) => status.trim()).filter(Boolean)));
    if (normalized.length === 0) {
      toast({
        title: "لا يمكن حذف كل الحالات",
        description: "اترك حالة واحدة على الأقل للطلاب.",
        variant: "destructive",
      });
      return;
    }

    const previous = statuses;
    setStatuses(normalized);
    try {
      await saveStudentStatuses(normalized);
      toast({ title: message, description: "ستظهر التغييرات في سجل الطلاب فوراً." });
    } catch (error: unknown) {
      setStatuses(previous);
      toast({
        title: "تعذّر حفظ الحالات",
        description: getErrorMessage(error) || "حاول مرة أخرى.",
        variant: "destructive",
      });
    }
  };

  const addStatus = async () => {
    if (readOnly) return;
    const value = newStatus.trim();
    if (!value) return;
    if (statuses.includes(value)) {
      toast({ title: "الحالة موجودة", description: "هذه الحالة مضافة مسبقاً." });
      return;
    }
    setNewStatus("");
    await persistStatuses([...statuses, value]);
  };

  const deleteStatus = async (status: string) => {
    if (readOnly) return;
    await persistStatuses(
      statuses.filter((item) => item !== status),
      "تم حذف الحالة",
    );
  };

  const resetStatuses = async () => {
    if (readOnly) return;
    await persistStatuses(DEFAULT_STATUSES, "تمت استعادة الحالات الافتراضية");
  };

  const persistColumns = async (next: CustomColumnDef[], message = "تم حفظ الأعمدة المخصصة") => {
    const previous = columns;
    setColumns(next);
    try {
      await saveCustomColumns(next);
      toast({ title: message, description: "ستظهر التغييرات في جدول سجل الطلاب." });
    } catch (error: unknown) {
      setColumns(previous);
      toast({
        title: "تعذّر حفظ الأعمدة",
        description: getErrorMessage(error) || "حاول مرة أخرى.",
        variant: "destructive",
      });
    }
  };

  const addColumn = async () => {
    if (readOnly) return;
    const name = newColumnName.trim();
    if (!name) return;
    if (columns.some((column) => column.name.trim() === name)) {
      toast({ title: "العمود موجود", description: "يوجد عمود مخصص بهذا الاسم مسبقاً." });
      return;
    }

    setNewColumnName("");
    await persistColumns([...columns, { id: makeId(), name, type: newColumnType }]);
  };

  const deleteColumn = async (columnId: string) => {
    if (readOnly) return;
    await persistColumns(
      columns.filter((column) => column.id !== columnId),
      "تم حذف العمود",
    );
  };

  const requiredDeletePhrase = advancedDeleteMode === "database" ? "حذف قاعدة البيانات" : "حذف";

  const toggleSelectedYearStudent = (studentId: number) => {
    setSelectedYearStudents((previous) => {
      const next = new Set(previous);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const openAdvancedDelete = (mode: "year" | "students" | "database") => {
    if (readOnly) return;
    setAdvancedDeleteMode(mode);
    setDeleteConfirmation("");
    setSelectedYearStudents(new Set());
    setAdvancedDeleteOpen(true);
  };

  const handleAdvancedDelete = async () => {
    if (readOnly || deleteConfirmation.trim() !== requiredDeletePhrase) return;
    if (advancedDeleteMode === "students" && selectedYearStudents.size === 0) return;

    const selectedCount = selectedYearStudents.size;
    setDeletingAdvanced(true);
    try {
      if (advancedDeleteMode === "year") {
        await deleteFullYearData(advancedDeleteYear);
        toast({
          title: "تم حذف العام",
          description: `تم حذف بيانات عام ${advancedDeleteYear}هـ مع إبقاء الطلاب في السجل العام.`,
          variant: "destructive",
        });
      } else if (advancedDeleteMode === "students") {
        await deleteStudentsFromYear(advancedDeleteYear, Array.from(selectedYearStudents));
        toast({
          title: "تم حذف الطلاب من العام",
          description: `تم فصل ${selectedCount} طالباً عن عام ${advancedDeleteYear}هـ دون حذف سجلاتهم العامة.`,
          variant: "destructive",
        });
      } else {
        await deleteEntireDatabase();
        toast({
          title: "تم حذف قاعدة البيانات",
          description: "تم حذف جميع بيانات الحساب نهائياً.",
          variant: "destructive",
        });
        setYearStudents([]);
      }
      setAdvancedDeleteOpen(false);
      setDeleteConfirmation("");
      setSelectedYearStudents(new Set());
      await loadSettings();
    } catch (error: unknown) {
      toast({
        title: "تعذّر تنفيذ الحذف",
        description: getErrorMessage(error) || "حاول مرة أخرى بعد التأكد من الاتصال.",
        variant: "destructive",
      });
    } finally {
      setDeletingAdvanced(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.14),transparent_34rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)/0.45))]"
      dir="rtl"
    >
      <header className="mx-3 mt-3 rounded-[2rem] bg-gradient-to-br from-primary via-emerald-700 to-teal-950 px-4 py-5 text-primary-foreground shadow-2xl shadow-primary/20">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-4 flex items-center justify-between">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-1 text-primary-foreground">
                <ArrowRight className="h-4 w-4" /> رجوع
              </Button>
            </Link>
            <img src={logo} alt="الشعار" className="h-16 w-auto" />
            <div className="w-20" />
          </div>
          <div className="text-center">
            <h1 className="flex items-center justify-center gap-2 text-2xl font-bold">
              <SettingsIcon className="h-6 w-6" /> إدارة الإعدادات
            </h1>
            <p className="mt-1 text-sm opacity-90">
              إعدادات الحساب والسنوات وحالات الطلاب والأعمدة المخصصة من مكان واحد
            </p>
            <p className="mt-1 text-xs font-semibold text-white/75">
              {BRAND_NAME_TAGGED} · {BRAND_LOCAL_NOTE}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl space-y-5 px-3 py-5 sm:px-4 sm:py-7">
        <OfflineNotice />

        {readOnly && (
          <div className="rounded-[1.5rem] border border-amber-300/60 bg-amber-100/80 p-4 text-sm leading-7 text-amber-900 shadow-lg">
            أنت تطالع بيانات <strong>{viewAs?.name}</strong> الآن. إعدادات السجل الخاصة بصاحب
            البيانات تظهر للقراءة فقط، ويمكنك العودة لبياناتك من الشريط الجانبي لتعديل إعداداتك.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          {settingsSummary.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="rounded-[1.5rem] border border-white/70 bg-card/90 p-4 shadow-lg shadow-primary/5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                    <div className="mt-1 text-xl font-black text-primary">{item.value}</div>
                  </div>
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {loading ? (
          <div className="rounded-[1.75rem] border border-white/70 bg-card/85 py-16 text-center text-muted-foreground shadow-xl shadow-primary/5">
            جارٍ تحميل الإعدادات...
          </div>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-5">
                <Card className="rounded-[1.75rem] border-white/70 bg-card/90 shadow-xl shadow-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <UserCog className="h-5 w-5 text-primary" /> الملف الشخصي
                    </CardTitle>
                    <CardDescription>
                      عدّل الاسم الظاهر لحسابك، وسيظهر في إدارة المستخدمين.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="profile-name">الاسم الظاهر</Label>
                      <Input
                        id="profile-name"
                        value={profileName}
                        onChange={(event) => setProfileName(event.target.value)}
                        placeholder="اسم المستخدم"
                        className="h-11 rounded-2xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-email">البريد الإلكتروني</Label>
                      <Input
                        id="profile-email"
                        value={profileEmail}
                        readOnly
                        dir="ltr"
                        className="h-11 rounded-2xl bg-muted/70 text-muted-foreground"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/60 p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Shield className="h-4 w-4 text-primary" />
                        <span>صلاحية الحساب</span>
                      </div>
                      <Badge variant={isAdmin ? "default" : "secondary"}>
                        {isAdmin ? "مسؤول" : "مستخدم"}
                      </Badge>
                    </div>
                    <Button
                      onClick={() => void saveProfile()}
                      disabled={savingProfile}
                      className="w-full gap-2 rounded-2xl"
                    >
                      <Save className="h-4 w-4" />
                      {savingProfile ? "جارٍ الحفظ..." : "حفظ الملف الشخصي"}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="rounded-[1.75rem] border-white/70 bg-card/90 shadow-xl shadow-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CalendarDays className="h-5 w-5 text-primary" /> العام النشط
                    </CardTitle>
                    <CardDescription>
                      اختر السنة الهجرية التي تُفتح افتراضياً في صفحات النظام.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Select
                      value={currentYear}
                      onValueChange={(value) => void saveYear(value)}
                      disabled={savingYear}
                    >
                      <SelectTrigger className="h-11 rounded-2xl">
                        <SelectValue placeholder="اختر العام" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            {year}هـ
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs leading-6 text-muted-foreground">
                      تغيير العام هنا يؤثر على الصفحات التي تعتمد العام النشط مثل السجل والمسابقات
                      والمصروفات.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-5">
                <Card className="rounded-[1.75rem] border-white/70 bg-card/90 shadow-xl shadow-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CheckCircle2 className="h-5 w-5 text-primary" /> حالات الطلاب
                    </CardTitle>
                    <CardDescription>
                      أضف الحالات التي تريد ظهورها في خانة حالة الطالب.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={newStatus}
                        onChange={(event) => setNewStatus(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void addStatus();
                          }
                        }}
                        placeholder="مثال: مكفول، متفوق، منقطع"
                        disabled={readOnly}
                        className="h-11 rounded-2xl"
                      />
                      <Button
                        onClick={() => void addStatus()}
                        disabled={readOnly || !newStatus.trim()}
                        className="gap-2 rounded-2xl"
                      >
                        <Plus className="h-4 w-4" /> إضافة
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {statuses.map((status) => (
                        <span
                          key={status}
                          className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary"
                        >
                          {status}
                          <button
                            type="button"
                            onClick={() => void deleteStatus(status)}
                            disabled={readOnly || statuses.length <= 1}
                            className="rounded-full p-0.5 text-primary/70 hover:bg-primary/15 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                            aria-label={`حذف ${status}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => void resetStatuses()}
                      disabled={readOnly}
                      className="w-full gap-2 rounded-2xl"
                    >
                      <RotateCcw className="h-4 w-4" /> استعادة الحالات الافتراضية
                    </Button>
                  </CardContent>
                </Card>

                <Card className="rounded-[1.75rem] border-white/70 bg-card/90 shadow-xl shadow-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Columns3 className="h-5 w-5 text-primary" /> الأعمدة المخصصة
                    </CardTitle>
                    <CardDescription>أضف أعمدة إضافية تظهر داخل سجل الطلاب الرسمي.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
                      <Input
                        value={newColumnName}
                        onChange={(event) => setNewColumnName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void addColumn();
                          }
                        }}
                        placeholder="اسم العمود"
                        disabled={readOnly}
                        className="h-11 rounded-2xl"
                      />
                      <Select
                        value={newColumnType}
                        onValueChange={(value) =>
                          setNewColumnType(value as NonNullable<CustomColumnDef["type"]>)
                        }
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-11 rounded-2xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(columnTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => void addColumn()}
                        disabled={readOnly || !newColumnName.trim()}
                        className="gap-2 rounded-2xl"
                      >
                        <Plus className="h-4 w-4" /> إضافة
                      </Button>
                    </div>

                    {columns.length === 0 ? (
                      <div className="rounded-2xl border border-dashed bg-muted/40 p-5 text-center text-sm text-muted-foreground">
                        لا توجد أعمدة مخصصة بعد.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {columns.map((column) => (
                          <div
                            key={column.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-background/70 px-3 py-2"
                          >
                            <div>
                              <div className="font-semibold">{column.name}</div>
                              <div className="text-xs text-muted-foreground">
                                النوع: {columnTypeLabels[column.type || "text"]}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void deleteColumn(column.id)}
                              disabled={readOnly}
                              className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" /> حذف
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="rounded-[1.75rem] border-destructive/25 bg-destructive/[0.03] shadow-xl shadow-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                  <AlertTriangle className="h-5 w-5" /> الحذف المتقدم
                </CardTitle>
                <CardDescription>
                  استخدم هذه الأدوات بحذر. حذف عام أو طالب من عام لا يحذف السجل العام للطالب، بينما
                  حذف قاعدة البيانات يحذف كل بيانات الحساب نهائياً.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <Button
                  variant="outline"
                  disabled={readOnly}
                  onClick={() => openAdvancedDelete("year")}
                  className="h-auto min-h-24 flex-col items-start gap-2 rounded-2xl border-destructive/30 p-4 text-right hover:bg-destructive/5"
                >
                  <CalendarDays className="h-5 w-5 text-destructive" />
                  <span className="font-bold">حذف عام كامل</span>
                  <span className="text-xs font-normal leading-5 text-muted-foreground">
                    احذف كل بيانات عام محدد، مع إبقاء الطلاب في السجل العام.
                  </span>
                </Button>
                <Button
                  variant="outline"
                  disabled={readOnly}
                  onClick={() => openAdvancedDelete("students")}
                  className="h-auto min-h-24 flex-col items-start gap-2 rounded-2xl border-destructive/30 p-4 text-right hover:bg-destructive/5"
                >
                  <UsersRound className="h-5 w-5 text-destructive" />
                  <span className="font-bold">حذف طلاب من عام</span>
                  <span className="text-xs font-normal leading-5 text-muted-foreground">
                    اختر عدة طلاب لفصلهم من عام واحد فقط دون حذف سجلاتهم العامة.
                  </span>
                </Button>
                <Button
                  variant="outline"
                  disabled={readOnly}
                  onClick={() => openAdvancedDelete("database")}
                  className="h-auto min-h-24 flex-col items-start gap-2 rounded-2xl border-destructive/50 p-4 text-right text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Database className="h-5 w-5" />
                  <span className="font-bold">حذف قاعدة البيانات كاملة</span>
                  <span className="text-xs font-normal leading-5 text-muted-foreground">
                    يحذف جميع بيانات الحساب والملفات المرفوعة نهائياً.
                  </span>
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <Dialog
        open={advancedDeleteOpen}
        onOpenChange={(open) => {
          if (!deletingAdvanced) setAdvancedDeleteOpen(open);
          if (!open) {
            setDeleteConfirmation("");
            setSelectedYearStudents(new Set());
          }
        }}
      >
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> تأكيد الحذف المتقدم
            </DialogTitle>
            <DialogDescription className="leading-6">
              هذا الإجراء لا يمكن التراجع عنه. اكتب عبارة التأكيد المطلوبة في الحقل قبل التنفيذ.
            </DialogDescription>
          </DialogHeader>

          {advancedDeleteMode !== "database" && (
            <div className="space-y-2">
              <Label htmlFor="advanced-delete-year">العام المستهدف</Label>
              <Select value={advancedDeleteYear} onValueChange={setAdvancedDeleteYear}>
                <SelectTrigger id="advanced-delete-year" className="h-11 rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}هـ
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {advancedDeleteMode === "year" && (
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-3 text-sm leading-6">
              سيُحذف كل ما يرتبط بعام <strong>{advancedDeleteYear}هـ</strong> من المتابعة والمسابقات
              والداعمين والجوائز والمصروفات والوسائط، مع بقاء الطلاب وسجلات الأعوام الأخرى.
            </div>
          )}

          {advancedDeleteMode === "students" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>طلاب عام {advancedDeleteYear}هـ</Label>
                <span className="text-xs text-muted-foreground">
                  المحدد: {selectedYearStudents.size}
                </span>
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border bg-muted/30 p-2">
                {yearStudents.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    لا يوجد طلاب مسجلون في هذا العام.
                  </p>
                ) : (
                  yearStudents.map((student) => (
                    <label
                      key={student.id}
                      className="flex cursor-pointer items-center gap-2 rounded-xl p-2 hover:bg-background"
                    >
                      <Checkbox
                        checked={selectedYearStudents.has(student.id)}
                        onCheckedChange={() => toggleSelectedYearStudent(student.id)}
                      />
                      <span className="text-sm">{student.name || "بدون اسم"}</span>
                      {student.teacher && (
                        <span className="text-xs text-muted-foreground">— {student.teacher}</span>
                      )}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {advancedDeleteMode === "database" && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm leading-6 text-destructive">
              سيُحذف الطلاب والسجلات الأكاديمية وكل البيانات السنوية والإعدادات والوسائط من الحساب.
              لا يمكن استعادة هذه البيانات.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="advanced-delete-confirmation">
              اكتب: <strong className="text-destructive">{requiredDeletePhrase}</strong>
            </Label>
            <Input
              id="advanced-delete-confirmation"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder={requiredDeletePhrase}
              autoComplete="off"
              className="h-11 rounded-2xl"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={deletingAdvanced}
              onClick={() => setAdvancedDeleteOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={
                deletingAdvanced ||
                deleteConfirmation.trim() !== requiredDeletePhrase ||
                (advancedDeleteMode === "students" && selectedYearStudents.size === 0)
              }
              onClick={() => void handleAdvancedDelete()}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {deletingAdvanced ? "جارٍ الحذف..." : "تنفيذ الحذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
