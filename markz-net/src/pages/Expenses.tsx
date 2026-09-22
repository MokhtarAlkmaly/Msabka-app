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
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/lib/router-compat";
import { ArrowRight, Receipt, Plus, Pencil, Trash2, Save, Printer, Calendar } from "lucide-react";
import logo from "@/assets/logo.png";
import { START_YEAR, END_YEAR } from "@/types/student";
import {
  getActiveYear,
  setActiveYear,
  loadCeremonyExpenses,
  saveCeremonyExpense,
  deleteCeremonyExpenseLocal,
  loadDonors,
} from "@/utils/storage";
import { esc, printHtml, riyal } from "@/utils/report";

interface Expense {
  id: string;
  year: string;
  category: string;
  description: string;
  amount: number;
  spent_at: string;
  funded_by: string | null;
  notes: string | null;
}

export const EXPENSE_CATEGORIES: Record<string, string> = {
  supplies: "مستلزمات الحفل",
  hospitality: "ضيافة وأطعمة",
  gifts: "هدايا وجوائز",
  printing: "طباعة وشهادات",
  decor: "تجهيز وديكور",
  logistics: "نقل وتشغيل",
  other: "أخرى",
};

const Expenses = () => {
  const { toast } = useToast();
  const [currentYear, setCurrentYear] = useState("");
  const [rows, setRows] = useState<Expense[]>([]);
  const [donors, setDonors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: "supplies",
    description: "",
    amount: "0",
    spent_at: new Date().toISOString().slice(0, 10),
    funded_by: "",
    notes: "",
  });

  const load = useCallback(async () => {
    if (!currentYear) return;
    setLoading(true);
    const [data, donorData] = await Promise.all([
      loadCeremonyExpenses(currentYear),
      loadDonors(currentYear),
    ]);
    setRows((data as Expense[]) || []);
    setDonors((donorData || []).map((d) => d.name));
    setLoading(false);
  }, [currentYear]);

  useEffect(() => {
    void (async () => setCurrentYear(await getActiveYear()))();
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.amount || 0), 0), [rows]);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      category: "supplies",
      description: "",
      amount: "0",
      spent_at: new Date().toISOString().slice(0, 10),
      funded_by: "",
      notes: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (r: Expense) => {
    setEditingId(r.id);
    setForm({
      category: r.category,
      description: r.description,
      amount: String(r.amount),
      spent_at: r.spent_at,
      funded_by: r.funded_by || "",
      notes: r.notes || "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.description.trim()) {
      toast({ title: "الوصف مطلوب", variant: "destructive" });
      return;
    }
    const payload = {
      year: currentYear,
      category: form.category,
      description: form.description.trim(),
      amount: parseFloat(form.amount) || 0,
      spent_at: form.spent_at,
      funded_by: form.funded_by.trim() || null,
      notes: form.notes.trim() || null,
    };
    await saveCeremonyExpense(editingId ? { ...payload, id: editingId } : payload);
    toast({ title: editingId ? "تم التعديل" : "تمت الإضافة" });
    setDialogOpen(false);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا المصروف؟")) return;
    await deleteCeremonyExpenseLocal(id);
    toast({ title: "تم الحذف", variant: "destructive" });
    await load();
  };

  const print = () => {
    const byCat = new Map<string, number>();
    rows.forEach((r) =>
      byCat.set(r.category, (byCat.get(r.category) || 0) + Number(r.amount || 0)),
    );
    const html = `<h1>مصروفات الحفل السنوي</h1>
      <div class="sub">عام ${esc(currentYear)}هـ</div>
      <div class="cards">
        <div class="card"><span>عدد البنود</span><b>${rows.length}</b></div>
        <div class="card"><span>إجمالي المصروفات</span><b>${riyal(total)}</b></div>
      </div>
      <h2>حسب البند</h2>
      <table><thead><tr><th>البند</th><th>المبلغ</th></tr></thead><tbody>
        ${Array.from(byCat.entries())
          .map(
            ([c, v]) =>
              `<tr><td>${esc(EXPENSE_CATEGORIES[c] || c)}</td><td class="num">${riyal(v)}</td></tr>`,
          )
          .join("")}
      </tbody></table>
      <h2>التفاصيل</h2>
      <table><thead><tr><th>البند</th><th>الوصف</th><th>المبلغ</th><th>الجهة الممولة</th><th>التاريخ</th></tr></thead><tbody>
        ${rows
          .map(
            (r) =>
              `<tr><td>${esc(EXPENSE_CATEGORIES[r.category] || r.category)}</td><td>${esc(
                r.description,
              )}</td><td class="num">${riyal(Number(r.amount))}</td><td>${esc(r.funded_by || "—")}</td><td class="num">${esc(
                r.spent_at,
              )}</td></tr>`,
          )
          .join("")}
      </tbody><tfoot><tr><td colspan="2">المجموع</td><td class="num">${riyal(total)}</td><td colspan="2"></td></tr></tfoot></table>`;
    printHtml(`مصروفات الحفل ${currentYear}`, html);
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
            <img src={logo} alt="الشعار" className="h-16 w-auto" />
            <div className="w-20" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
              <Receipt className="h-6 w-6" /> مصروفات الحفل
            </h1>
            <p className="text-sm opacity-90 mt-1">
              عام {currentYear}هـ — الإجمالي {total.toLocaleString()} ريال
            </p>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-7 space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">العام:</span>
            <Select
              value={currentYear}
              onValueChange={(v) => {
                setCurrentYear(v);
                void setActiveYear(v);
              }}
            >
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={print} className="gap-1">
              <Printer className="h-4 w-4" /> طباعة
            </Button>
            <Button onClick={openAdd} className="gap-1">
              <Plus className="h-4 w-4" /> إضافة مصروف
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">لا توجد مصروفات مسجلة</div>
        ) : (
          <div className="overflow-x-auto rounded-[1.5rem] border border-white/70 bg-card/90 shadow-xl shadow-primary/5">
            <table className="w-full text-sm">
              <thead className="bg-primary/5">
                <tr>
                  <th className="px-3 py-2 text-right">#</th>
                  <th className="px-3 py-2 text-right">البند</th>
                  <th className="px-3 py-2 text-right">الوصف</th>
                  <th className="px-3 py-2 text-center">المبلغ</th>
                  <th className="px-3 py-2 text-right">الجهة الممولة</th>
                  <th className="px-3 py-2 text-center">التاريخ</th>
                  <th className="px-3 py-2 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2">{EXPENSE_CATEGORIES[r.category] || r.category}</td>
                    <td className="px-3 py-2 font-medium">{r.description}</td>
                    <td className="px-3 py-2 text-center font-semibold text-primary">
                      {Number(r.amount).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{r.funded_by || "—"}</td>
                    <td className="px-3 py-2 text-center text-xs">{r.spent_at}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => void remove(r.id)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل مصروف" : "إضافة مصروف"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">البند</label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">المبلغ (ريال)</label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">الوصف</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="مثال: شراء 100 هدية للطلاب"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">الجهة الممولة</label>
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
              <div>
                <label className="text-sm font-medium">التاريخ</label>
                <Input
                  type="date"
                  value={form.spent_at}
                  onChange={(e) => setForm({ ...form, spent_at: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">ملاحظات</label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={() => void save()} className="gap-1">
              <Save className="h-4 w-4" /> حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Expenses;
