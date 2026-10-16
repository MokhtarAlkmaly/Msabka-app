import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/lib/router-compat";
import {
  ArrowRight,
  Medal,
  Plus,
  Pencil,
  Trash2,
  Save,
  Printer,
  Calendar,
  Search,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { BRAND_PRINT_TITLE } from "@/lib/brand";
import { Student, START_YEAR, END_YEAR, InternalCompetition } from "@/types/student";
import {
  getActiveYear,
  setActiveYear,
  loadGlobalStudents,
  loadInternalCompetitions,
  saveInternalCompetition,
  deleteInternalCompetitionLocal,
} from "@/utils/storage";
import { esc } from "@/utils/report";

const InternalCompetitions = () => {
  const { toast } = useToast();
  const [currentYear, setCurrentYear] = useState<string>("1447");
  const [rows, setRows] = useState<InternalCompetition[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    student_id: 0,
    student_name: "",
    year: "1447",
    competition_name: "",
    category: "فرع 5 أجزاء",
    score: "95",
    rank: "المركز الأول",
    prize: "شهادة ومكافأة نقدية",
    notes: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [allStudents, compRows] = await Promise.all([
      loadGlobalStudents(),
      loadInternalCompetitions(currentYear),
    ]);
    setStudents(allStudents);
    setRows(compRows);
    setLoading(false);
  }, [currentYear]);

  useEffect(() => {
    void (async () => {
      const year = await getActiveYear();
      setCurrentYear(year);
      setForm((f) => ({ ...f, year }));
    })();
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleYearChange = async (y: string) => {
    setCurrentYear(y);
    await setActiveYear(y);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({
      student_id: students[0]?.id || 0,
      student_name: students[0]?.name || "",
      year: currentYear,
      competition_name: "مسابقة الماهر بالقرآن الداخلية",
      category: "فرع 5 أجزاء",
      score: "95",
      rank: "المركز الأول",
      prize: "شهادة ومكافأة مالية",
      notes: "",
      date: new Date().toISOString().slice(0, 10),
    });
    setDialogOpen(true);
  };

  const openEdit = (item: InternalCompetition) => {
    setEditingId(item.id);
    setForm({
      student_id: item.student_id,
      student_name: item.student_name,
      year: item.year,
      competition_name: item.competition_name,
      category: item.category,
      score: String(item.score),
      rank: item.rank,
      prize: item.prize,
      notes: item.notes || "",
      date: item.date || new Date().toISOString().slice(0, 10),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.student_name.trim()) {
      toast({ title: "اسم الطالب مطلوب", variant: "destructive" });
      return;
    }
    await saveInternalCompetition({
      id: editingId || undefined,
      student_id: form.student_id,
      student_name: form.student_name.trim(),
      year: form.year,
      competition_name: form.competition_name.trim() || "مسابقة داخلية",
      category: form.category.trim(),
      score: parseFloat(form.score) || 0,
      rank: form.rank.trim(),
      prize: form.prize.trim(),
      notes: form.notes.trim() || null,
      date: form.date,
    });
    toast({ title: editingId ? "تم التعديل بنجاح" : "تمت إضافة المشاركة بنجاح" });
    setDialogOpen(false);
    await loadData();
  };

  const remove = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا السجل؟")) return;
    await deleteInternalCompetitionLocal(id);
    toast({ title: "تم الحذف", variant: "destructive" });
    await loadData();
  };

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(
      (r) =>
        r.student_name.toLowerCase().includes(q) ||
        r.competition_name.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.rank.toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  const handlePrint = async () => {
    const { printHtmlDocument } = await import("@/utils/nativePrint");

    const rowsHtml = filteredRows
      .map(
        (r, i) => `<tr>
        <td>${i + 1}</td>
        <td><b>${esc(r.student_name)}</b></td>
        <td>${esc(r.competition_name)}</td>
        <td>${esc(r.category)}</td>
        <td>${r.score}</td>
        <td><b>${esc(r.rank)}</b></td>
        <td>${esc(r.prize || "—")}</td>
        <td>${esc(r.date || "—")}</td>
      </tr>`,
      )
      .join("");

    const fullHtml = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>المسابقات الداخلية - ${currentYear}هـ</title>
      <style>
        body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;padding:24px;color:#1a3a2a}
        .header{text-align:center;border-bottom:3px double #0e6b3a;padding-bottom:12px;margin-bottom:16px}
        .header img{height:75px}
        .header h1{font-size:22px;color:#0e6b3a;margin:4px 0}
        .header h2{font-size:15px;color:#555}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}
        th,td{border:1px solid #bbb;padding:7px;text-align:center}
        th{background:#0e6b3a;color:#fff}
        tr:nth-child(even){background:#f9fdfb}
        .footer{text-align:center;margin-top:24px;font-size:11px;color:#888}
        @media print{@page{size:A4 landscape;margin:10mm}}
      </style></head><body>
        <div class="header">
          <img src="${logo}" alt="Markz Net — نسخة بلا إنترنت" />
          <h1>${BRAND_PRINT_TITLE}</h1>
          <h2>كشف المسابقات الداخلية - عام ${esc(currentYear)}هـ</h2>
        </div>
        <table>
          <thead>
            <tr><th>م</th><th>اسم الطالب</th><th>المسابقة</th><th>الفرع / الفئة</th><th>الدرجة</th><th>المركز / الترتيب</th><th>الجائزة والتكريم</th><th>التاريخ</th></tr>
          </thead>
          <tbody>${rowsHtml || '<tr><td colspan="8">لا توجد مشاركات مسجلة</td></tr>'}</tbody>
        </table>
        <div class="footer">طُبع بتاريخ: ${new Date().toLocaleDateString("ar-EG")}</div>
      </body></html>`;

    printHtmlDocument(fullHtml, `المسابقات_الداخلية_${currentYear}`);
  };

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
                <ArrowRight className="h-4 w-4" /> رجوع
              </Button>
            </Link>
            <img src={logo} alt="logo" className="h-16 w-auto" />
            <div className="w-20" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
              <Medal className="h-6 w-6 text-amber-400" />
              المسابقات القرآنية الداخلية
            </h1>
            <p className="text-sm opacity-90 mt-1">
              إدارة المسابقات والتصفيات الداخلية بMarkz Net — نسخة بلا إنترنت - عام {currentYear}هـ
            </p>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-7 space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
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

          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالطالب أو المسابقة..."
                className="h-9 pr-9 w-52 rounded-xl text-xs bg-background"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1 rounded-xl">
              <Printer className="h-4 w-4" /> طباعة
            </Button>
            <Button size="sm" onClick={openAdd} className="gap-1 rounded-xl">
              <Plus className="h-4 w-4" /> تسجيل مشاركة جديدة
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
        ) : filteredRows.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground border-dashed">
            لا توجد مشاركات في مسابقات داخلية مسجلة لعام {currentYear}هـ
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-[1.5rem] border border-white/70 bg-card/90 shadow-xl shadow-primary/5">
            <table className="w-full text-sm">
              <thead className="bg-primary/5 font-bold">
                <tr>
                  <th className="px-3 py-2 text-right">#</th>
                  <th className="px-3 py-2 text-right">اسم الطالب</th>
                  <th className="px-3 py-2 text-right">اسم المسابقة</th>
                  <th className="px-3 py-2 text-center">الفرع / المستوى</th>
                  <th className="px-3 py-2 text-center">الدرجة</th>
                  <th className="px-3 py-2 text-center">المركز / الترتيب</th>
                  <th className="px-3 py-2 text-right">الجائزة المستلمة</th>
                  <th className="px-3 py-2 text-center">التاريخ</th>
                  <th className="px-3 py-2 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((item, i) => (
                  <tr key={item.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-3 py-2 text-right">{i + 1}</td>
                    <td className="px-3 py-2 text-right font-bold text-foreground">
                      {item.student_name}
                    </td>
                    <td className="px-3 py-2 text-right">{item.competition_name}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant="outline">{item.category}</Badge>
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-primary">{item.score}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge className="bg-amber-600 text-white">{item.rank}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">{item.prize || "—"}</td>
                    <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                      {item.date}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => remove(item.id)}>
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "تعديل المشاركة بالمسابقة" : "تسجيل مشاركة بمسابقة داخلية"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div>
              <label className="font-bold">اسم الطالب</label>
              <Select
                value={String(form.student_id)}
                onValueChange={(v) => {
                  const s = students.find((st) => st.id === parseInt(v));
                  setForm({
                    ...form,
                    student_id: parseInt(v),
                    student_name: s?.name || "",
                  });
                }}
              >
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder="اختر الطالب من السجل" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {students.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="font-bold">اسم المسابقة الداخلية</label>
              <Input
                value={form.competition_name}
                onChange={(e) => setForm({ ...form, competition_name: e.target.value })}
                placeholder="مثال: مسابقة الماهر بالقرآن"
                className="h-9 mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold">الفرع / المستوى</label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="فرع 5 أجزاء"
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <label className="font-bold">العام</label>
                <Select value={form.year} onValueChange={(v) => setForm({ ...form, year: v })}>
                  <SelectTrigger className="h-9 mt-1">
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
                <label className="font-bold">الدرجة</label>
                <Input
                  type="number"
                  value={form.score}
                  onChange={(e) => setForm({ ...form, score: e.target.value })}
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <label className="font-bold">المركز / الترتيب</label>
                <Input
                  value={form.rank}
                  onChange={(e) => setForm({ ...form, rank: e.target.value })}
                  placeholder="المركز الأول"
                  className="h-9 mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold">الجائزة المستلمة</label>
                <Input
                  value={form.prize}
                  onChange={(e) => setForm({ ...form, prize: e.target.value })}
                  placeholder="مكافأة مالية وشهادة"
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <label className="font-bold">التاريخ</label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="h-9 mt-1"
                />
              </div>
            </div>

            <div>
              <label className="font-bold">ملاحظات</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="mt-1"
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

export default InternalCompetitions;
