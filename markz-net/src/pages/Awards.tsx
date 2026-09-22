import { useState, useEffect, useCallback, useMemo, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/lib/router-compat";
import {
  ArrowRight,
  Award,
  Plus,
  Pencil,
  Trash2,
  Save,
  Printer,
  Gift,
  Sparkles,
  Calendar,
  HeartHandshake,
  Search as SearchIcon,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { Student, START_YEAR, END_YEAR } from "@/types/student";
import { RecallStudents } from "@/components/RecallStudents";
import {
  loadAllStudentsWithData,
  getActiveYear,
  setActiveYear,
  loadTeachers,
  loadDonors,
  loadAwards,
  saveAward,
  deleteAwardLocal,
  loadTeacherBonuses,
} from "@/utils/storage";

type AwardType = "khatm_bonus" | "ceremony" | "annual" | "certificate" | "guardian_contribution";
type AwardKind = "cash" | "in_kind";
type RecipientType =
  "teacher" | "male_teacher" | "student" | "male_student" | "orphan" | "needy" | "other";

const RECIPIENT_LABEL: Record<RecipientType, string> = {
  teacher: "معلم/ة",
  male_teacher: "معلم",
  student: "طالب/ة",
  male_student: "طالب",
  orphan: "يتيم/يتيمة",
  needy: "مسكين/مسكينة",
  other: "أخرى",
};

interface AwardRow {
  id: string;
  year: string;
  recipient_type: RecipientType;
  recipient_name: string;
  award_type: AwardType;
  award_kind: AwardKind;
  amount: number;
  item: string | null;
  student_name: string | null;
  notes: string | null;
  awarded_at: string;
  funded_by: string | null;
}

const TYPE_LABEL: Record<AwardType, string> = {
  khatm_bonus: "إكرامية خاتمة",
  ceremony: "حفل التكريم",
  annual: "إكرامية سنوية",
  certificate: "شهادة/جائزة",
  guardian_contribution: "مساهمة ولي أمر",
};
const TYPE_ICON: Record<AwardType, ReactElement> = {
  khatm_bonus: <Sparkles className="h-4 w-4 text-amber-600" />,
  ceremony: <Award className="h-4 w-4 text-purple-600" />,
  annual: <Gift className="h-4 w-4 text-emerald-600" />,
  certificate: <Award className="h-4 w-4 text-sky-600" />,
  guardian_contribution: <HeartHandshake className="h-4 w-4 text-rose-600" />,
};

const esc = (s: string) =>
  (s || "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

const Awards = () => {
  const { toast } = useToast();
  const [currentYear, setCurrentYear] = useState<string>("");
  const [awards, setAwards] = useState<AwardRow[]>([]);
  const [teachers, setTeachers] = useState<string[]>([]);
  const [donors, setDonors] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AwardType>("khatm_bonus");

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    year: "1447",
    award_type: "khatm_bonus" as AwardType,
    recipient_type: "teacher" as RecipientType,
    recipient_name: "",
    student_name: "",
    award_kind: "cash" as AwardKind,
    amount: "0",
    item: "",
    notes: "",
    awarded_at: new Date().toISOString().slice(0, 10),
    funded_by: "",
  });

  const loadAll = useCallback(async () => {
    if (!currentYear) return;
    setLoading(true);
    const year = currentYear;
    setForm((f) => ({ ...f, year }));
    const list = await loadAllStudentsWithData(year);
    setStudents(list);
    const regData = await loadTeachers(year);
    const merged = new Set<string>();
    regData.forEach((r) => merged.add(r.name));
    list.forEach((s) => {
      const t = (s.teacher || "").trim();
      if (t) merged.add(t);
    });
    setTeachers(Array.from(merged).sort((a, b) => a.localeCompare(b, "ar")));
    setDonors((await loadDonors(year)).map((d) => d.name));
    setAwards((await loadAwards()) as AwardRow[]);
    setLoading(false);
  }, [currentYear]);

  useEffect(() => {
    void (async () => setCurrentYear(await getActiveYear()))();
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleYearChange = async (y: string) => {
    setCurrentYear(y);
    await setActiveYear(y);
  };

  const khatimat = useMemo(
    () =>
      students
        .filter((s) => {
          const total = parseFloat(s.yearData?.totalHifz || "0");
          return total >= 30;
        })
        .map((s) => s.name)
        .filter(Boolean),
    [students],
  );

  // كل طلاب العام المسجّلين (لا الخاتمين فقط) — لاختيار المستفيد بالبحث/القائمة
  const allStudentNames = useMemo(
    () =>
      students
        .map((s) => s.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ar")),
    [students],
  );
  const filteredStudentNames = useMemo(() => {
    const q = studentQuery.trim();
    if (!q) return allStudentNames.slice(0, 30);
    return allStudentNames.filter((n) => n.includes(q)).slice(0, 30);
  }, [allStudentNames, studentQuery]);

  const yearAwards = useMemo(
    () => awards.filter((a) => a.year === currentYear),
    [awards, currentYear],
  );

  const byType = (t: AwardType) => yearAwards.filter((a) => a.award_type === t);

  const openAdd = (type: AwardType) => {
    setEditingId(null);
    setForm({
      year: currentYear,
      award_type: type,
      recipient_type:
        type === "certificate" || type === "guardian_contribution" ? "student" : "teacher",
      recipient_name: "",
      student_name: "",
      award_kind: type === "certificate" ? "in_kind" : "cash",
      amount: "0",
      item: "",
      notes: "",
      awarded_at: new Date().toISOString().slice(0, 10),
      funded_by: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (a: AwardRow) => {
    setEditingId(a.id);
    setForm({
      year: a.year,
      award_type: a.award_type,
      recipient_type: a.recipient_type,
      recipient_name: a.recipient_name,
      student_name: a.student_name || "",
      award_kind: a.award_kind,
      amount: String(a.amount),
      item: a.item || "",
      notes: a.notes || "",
      awarded_at: a.awarded_at,
      funded_by: a.funded_by || "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.recipient_name.trim()) {
      toast({ title: "الاسم مطلوب", variant: "destructive" });
      return;
    }
    const payload = {
      year: form.year,
      recipient_type: form.recipient_type,
      recipient_name: form.recipient_name.trim(),
      award_type: form.award_type,
      award_kind: form.award_kind,
      amount: parseFloat(form.amount) || 0,
      item: form.item.trim() || null,
      student_name: form.student_name.trim() || null,
      notes: form.notes.trim() || null,
      awarded_at: form.awarded_at,
      funded_by: form.funded_by.trim() || null,
    };
    await saveAward(editingId ? { ...payload, id: editingId } : payload);
    toast({ title: editingId ? "تم التعديل" : "تمت الإضافة" });
    setDialogOpen(false);
    await loadAll();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا السجل؟")) return;
    await deleteAwardLocal(id);
    toast({ title: "تم الحذف", variant: "destructive" });
    await loadAll();
  };

  const totalOf = (rows: AwardRow[]) => rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const printReport = async () => {
    const { printHtmlDocument } = await import("@/utils/nativePrint");
    const bonuses = (await loadTeacherBonuses(currentYear)) as {
      teacher_name: string;
      amount: number;
      month: number;
    }[];

    // group by teacher
    const teacherMap = new Map<
      string,
      { monthly: number; khatm: number; ceremony: number; annual: number; certificates: AwardRow[] }
    >();
    const ensure = (name: string) => {
      if (!teacherMap.has(name))
        teacherMap.set(name, { monthly: 0, khatm: 0, ceremony: 0, annual: 0, certificates: [] });
      return teacherMap.get(name)!;
    };
    bonuses.forEach((b) => (ensure(b.teacher_name).monthly += Number(b.amount || 0)));
    yearAwards
      .filter((a) => a.recipient_type === "teacher")
      .forEach((a) => {
        const t = ensure(a.recipient_name);
        if (a.award_type === "khatm_bonus") t.khatm += Number(a.amount || 0);
        else if (a.award_type === "ceremony") t.ceremony += Number(a.amount || 0);
        else if (a.award_type === "annual") t.annual += Number(a.amount || 0);
        else if (a.award_type === "certificate") t.certificates.push(a);
      });

    const studentAwards = yearAwards.filter((a) => a.recipient_type !== "teacher");

    const teachersHtml = Array.from(teacherMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "ar"))
      .map(([name, v]) => {
        const total = v.monthly + v.khatm + v.ceremony + v.annual;
        const certs = v.certificates
          .map(
            (c) =>
              `<div>• ${esc(TYPE_LABEL[c.award_type])} — ${
                c.award_kind === "cash"
                  ? `${Number(c.amount).toLocaleString()} ريال`
                  : esc(c.item || "عيني")
              }${c.notes ? ` — ${esc(c.notes)}` : ""}</div>`,
          )
          .join("");
        return `<tr>
          <td>${esc(name)}</td>
          <td class="num">${v.monthly.toLocaleString()}</td>
          <td class="num">${v.khatm.toLocaleString()}</td>
          <td class="num">${v.ceremony.toLocaleString()}</td>
          <td class="num">${v.annual.toLocaleString()}</td>
          <td class="num total">${total.toLocaleString()}</td>
          <td>${certs || "—"}</td>
        </tr>`;
      })
      .join("");

    const studentsHtml = studentAwards
      .map(
        (a) => `<tr>
          <td>${esc(a.recipient_name)}</td>
          <td>${esc(TYPE_LABEL[a.award_type])}</td>
          <td>${a.award_kind === "cash" ? "نقدية" : "عينية"}</td>
          <td class="num">${Number(a.amount || 0).toLocaleString()}</td>
          <td>${esc(a.item || "—")}</td>
          <td>${esc(a.notes || "—")}</td>
        </tr>`,
      )
      .join("");

    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>تقرير الإكراميات والجوائز - ${esc(currentYear)}هـ</title>
      <style>
        body{font-family:'Traditional Arabic','Tahoma',sans-serif;direction:rtl;padding:24px;color:#222}
        h1{text-align:center;color:#0e6b3a;margin:0 0 4px}
        h2{color:#0e6b3a;border-bottom:2px solid #0e6b3a;padding-bottom:4px;margin-top:28px}
        .sub{text-align:center;color:#666;margin-bottom:20px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{border:1px solid #999;padding:6px 8px;text-align:right;vertical-align:top}
        th{background:#0e6b3a;color:#fff}
        .num{text-align:center;font-variant-numeric:tabular-nums}
        .total{font-weight:bold;background:#f4faf6}
        tfoot td{font-weight:bold;background:#eef7f1}
        @media print{@page{size:A4;margin:12mm}}
      </style></head><body>
      <h1>تقرير الإكراميات والجوائز</h1>
      <div class="sub">عام ${esc(currentYear)}هـ</div>

      <h2>إكراميات المعلمين والمعلمات</h2>
      ${
        teachersHtml
          ? `<table><thead><tr>
            <th>المعلم/ة</th><th>الشهرية</th><th>الخاتمين</th><th>حفل التكريم</th><th>السنوية</th><th>المجموع</th><th>الشهادات/الجوائز</th>
          </tr></thead><tbody>${teachersHtml}</tbody></table>`
          : '<div style="text-align:center;color:#888">لا توجد بيانات</div>'
      }

      <h2>شهادات وجوائز الطلاب الخاتمين والخاتمات</h2>
      ${
        studentsHtml
          ? `<table><thead><tr>
            <th>الطالب/ة</th><th>النوع</th><th>نقدية/عينية</th><th>المبلغ</th><th>الجائزة</th><th>ملاحظات</th>
          </tr></thead><tbody>${studentsHtml}</tbody></table>`
          : '<div style="text-align:center;color:#888">لا توجد بيانات</div>'
      }
    </body></html>`;

    printHtmlDocument(html, `تقرير_الإكراميات_${currentYear}`);
  };

  const renderTable = (rows: AwardRow[], type: AwardType) => (
    <div className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-card/90 shadow-xl shadow-primary/5">
      <div className="flex items-center justify-between p-3 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2 font-semibold">
          {TYPE_ICON[type]}
          {TYPE_LABEL[type]}
          <span className="text-sm text-muted-foreground">
            ({rows.length}) — المجموع النقدي:{" "}
            <span className="text-primary font-bold">{totalOf(rows).toLocaleString()} ريال</span>
          </span>
        </div>
        <Button size="sm" onClick={() => openAdd(type)} className="gap-1">
          <Plus className="h-4 w-4" /> إضافة
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">لا توجد سجلات</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary/5">
              <tr>
                <th className="px-3 py-2 text-right">#</th>
                <th className="px-3 py-2 text-right">المستفيد</th>
                <th className="px-3 py-2 text-center">الفئة</th>
                {type === "khatm_bonus" && (
                  <th className="px-3 py-2 text-right">الطالب/ة الخاتم/ة</th>
                )}
                <th className="px-3 py-2 text-center">نقدية/عينية</th>
                <th className="px-3 py-2 text-center">المبلغ</th>
                <th className="px-3 py-2 text-right">الجائزة/الوصف</th>
                <th className="px-3 py-2 text-right">ملاحظات</th>
                <th className="px-3 py-2 text-center">التاريخ</th>
                <th className="px-3 py-2 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <tr key={a.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-3 py-2 text-right">{i + 1}</td>
                  <td className="px-3 py-2 text-right font-medium">{a.recipient_name}</td>
                  <td className="px-3 py-2 text-center">
                    {RECIPIENT_LABEL[a.recipient_type] || a.recipient_type}
                  </td>
                  {type === "khatm_bonus" && (
                    <td className="px-3 py-2 text-right">{a.student_name || "—"}</td>
                  )}
                  <td className="px-3 py-2 text-center">
                    {a.award_kind === "cash" ? "نقدية" : "عينية"}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold text-primary">
                    {Number(a.amount || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">{a.item || "—"}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{a.notes || "—"}</td>
                  <td className="px-3 py-2 text-center text-xs">{a.awarded_at}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-center">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        onClick={() => openEdit(a)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        onClick={() => remove(a.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.14),transparent_34rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)/0.45))]"
      dir="rtl"
    >
      <header className="mx-3 mt-3 rounded-[2rem] bg-gradient-to-br from-primary via-emerald-700 to-teal-950 px-4 py-5 text-primary-foreground shadow-2xl shadow-primary/20">
        <div className="container mx-auto max-w-7xl">
          <div className="flex items-center justify-between mb-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-primary-foreground gap-1">
                <ArrowRight className="h-4 w-4" />
                رجوع
              </Button>
            </Link>
            <img src={logo} alt="logo" className="h-16 w-auto" />
            <div className="w-20" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
              <Award className="h-6 w-6" />
              الإكراميات والجوائز
            </h1>
            <p className="text-sm opacity-90 mt-1">عام {currentYear}هـ</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-7 space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">العام:</span>
              <Select value={currentYear} onValueChange={(v) => void handleYearChange(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i).map(
                    (y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}هـ
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <RecallStudents
              targetYear={currentYear}
              onRecalled={loadAll}
              buttonClassName="h-9 gap-1.5 rounded-xl text-xs font-bold"
            />
          </div>
          <Button onClick={printReport} variant="outline" className="gap-2">
            <Printer className="h-4 w-4" /> طباعة التقرير
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AwardType)}>
            <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
              <TabsTrigger value="khatm_bonus" className="gap-1">
                <Sparkles className="h-4 w-4" /> الخاتمين
              </TabsTrigger>
              <TabsTrigger value="ceremony" className="gap-1">
                <Award className="h-4 w-4" /> حفل التكريم
              </TabsTrigger>
              <TabsTrigger value="annual" className="gap-1">
                <Gift className="h-4 w-4" /> السنوية
              </TabsTrigger>
              <TabsTrigger value="certificate" className="gap-1">
                <Award className="h-4 w-4" /> الشهادات والجوائز
              </TabsTrigger>
              <TabsTrigger value="guardian_contribution" className="gap-1">
                <HeartHandshake className="h-4 w-4" /> مساهمات أولياء الأمور
              </TabsTrigger>
            </TabsList>
            <TabsContent value="khatm_bonus" className="mt-4">
              {renderTable(byType("khatm_bonus"), "khatm_bonus")}
            </TabsContent>
            <TabsContent value="ceremony" className="mt-4">
              {renderTable(byType("ceremony"), "ceremony")}
            </TabsContent>
            <TabsContent value="annual" className="mt-4">
              {renderTable(byType("annual"), "annual")}
            </TabsContent>
            <TabsContent value="certificate" className="mt-4">
              {renderTable(byType("certificate"), "certificate")}
            </TabsContent>
            <TabsContent value="guardian_contribution" className="mt-4">
              {renderTable(byType("guardian_contribution"), "guardian_contribution")}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {TYPE_ICON[form.award_type]}
              {editingId ? "تعديل" : "إضافة"} — {TYPE_LABEL[form.award_type]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">النوع</label>
                <Select
                  value={form.award_type}
                  onValueChange={(v) => setForm({ ...form, award_type: v as AwardType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABEL) as AwardType[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {TYPE_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">العام</label>
                <Select value={form.year} onValueChange={(v) => setForm({ ...form, year: v })}>
                  <SelectTrigger>
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">فئة المستفيد</label>
                <Select
                  value={form.recipient_type}
                  onValueChange={(v) =>
                    setForm({ ...form, recipient_type: v as RecipientType, recipient_name: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RECIPIENT_LABEL) as RecipientType[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {RECIPIENT_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">نقدية/عينية</label>
                <Select
                  value={form.award_kind}
                  onValueChange={(v) => setForm({ ...form, award_kind: v as AwardKind })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدية</SelectItem>
                    <SelectItem value="in_kind">عينية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">
                اسم المستفيد ({RECIPIENT_LABEL[form.recipient_type]})
              </label>
              {form.recipient_type === "teacher" && teachers.length > 0 ? (
                <Select
                  value={form.recipient_name}
                  onValueChange={(v) => setForm({ ...form, recipient_name: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المعلم/ة" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : form.recipient_type === "student" ? (
                <div className="relative">
                  <div className="relative">
                    <SearchIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={form.recipient_name || studentQuery}
                      onChange={(e) => {
                        setStudentQuery(e.target.value);
                        setForm({ ...form, recipient_name: e.target.value });
                      }}
                      onFocus={() => setStudentQuery(form.recipient_name || "")}
                      placeholder="ابحث عن الطالب/ة أو اختر من القائمة..."
                      className="pr-9"
                    />
                  </div>
                  {studentQuery && filteredStudentNames.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
                      {filteredStudentNames.map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            setForm({ ...form, recipient_name: n });
                            setStudentQuery("");
                          }}
                          className="block w-full px-3 py-2 text-right text-sm hover:bg-secondary"
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                  {allStudentNames.length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      لا يوجد طلاب مسجّلون بهذا العام
                    </p>
                  )}
                </div>
              ) : (
                <Input
                  value={form.recipient_name}
                  onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                  placeholder="اكتب الاسم"
                />
              )}
            </div>

            <div>
              <label className="text-sm font-medium">الجهة الممولة (فاعل الخير)</label>
              <Select
                value={form.funded_by || "__none__"}
                onValueChange={(v) => setForm({ ...form, funded_by: v === "__none__" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختياري" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— بدون تحديد —</SelectItem>
                  {donors.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.award_type === "khatm_bonus" && form.recipient_type === "teacher" && (
              <div>
                <label className="text-sm font-medium">الطالب/ة الخاتم/ة (اختياري)</label>
                <Select
                  value={form.student_name || "__none__"}
                  onValueChange={(v) =>
                    setForm({ ...form, student_name: v === "__none__" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— بدون تحديد —</SelectItem>
                    {khatimat.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">المبلغ (ريال)</label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  disabled={form.award_kind === "in_kind"}
                />
              </div>
              <div>
                <label className="text-sm font-medium">التاريخ</label>
                <Input
                  type="date"
                  value={form.awarded_at}
                  onChange={(e) => setForm({ ...form, awarded_at: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">
                {form.award_kind === "in_kind" ? "وصف الجائزة العينية" : "وصف/عنوان"}
              </label>
              <Input
                value={form.item}
                onChange={(e) => setForm({ ...form, item: e.target.value })}
                placeholder={
                  form.award_kind === "in_kind" ? "مثال: مصحف مذهّب، سجادة صلاة" : "اختياري"
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium">ملاحظات</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={save} className="gap-1">
              <Save className="h-4 w-4" /> حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Awards;
