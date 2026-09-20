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
import {
  ArrowRight,
  HeartHandshake,
  Plus,
  Pencil,
  Trash2,
  Save,
  Printer,
  Calendar,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { START_YEAR, END_YEAR } from "@/types/student";
import {
  getActiveYear,
  setActiveYear,
  loadDonors,
  saveDonor,
  deleteDonorLocal,
  loadAwards,
  loadCeremonyExpenses,
} from "@/utils/storage";
import { esc, printHtml, riyal } from "@/utils/report";

interface Donor {
  id: string;
  year: string;
  name: string;
  donor_type: string;
  phone: string | null;
  pledged_amount: number;
  paid_amount: number;
  in_kind: string | null;
  notes: string | null;
}

const emptyForm = {
  name: "",
  donor_type: "person",
  phone: "",
  pledged_amount: "0",
  paid_amount: "0",
  in_kind: "",
  notes: "",
};

const Donors = () => {
  const { toast } = useToast();
  const [currentYear, setCurrentYear] = useState("");
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!currentYear) return;
    setLoading(true);
    setDonors((await loadDonors(currentYear)) as Donor[]);
    setLoading(false);
  }, [currentYear]);

  useEffect(() => {
    void (async () => setCurrentYear(await getActiveYear()))();
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const handleYearChange = async (y: string) => {
    setCurrentYear(y);
    await setActiveYear(y);
  };

  const totals = useMemo(
    () =>
      donors.reduce(
        (acc, d) => ({
          pledged: acc.pledged + Number(d.pledged_amount || 0),
          paid: acc.paid + Number(d.paid_amount || 0),
        }),
        { pledged: 0, paid: 0 },
      ),
    [donors],
  );

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (d: Donor) => {
    setEditingId(d.id);
    setForm({
      name: d.name,
      donor_type: d.donor_type,
      phone: d.phone || "",
      pledged_amount: String(d.pledged_amount),
      paid_amount: String(d.paid_amount),
      in_kind: d.in_kind || "",
      notes: d.notes || "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "اسم الداعم مطلوب", variant: "destructive" });
      return;
    }
    const payload = {
      year: currentYear,
      name: form.name.trim(),
      donor_type: form.donor_type,
      phone: form.phone.trim() || null,
      pledged_amount: parseFloat(form.pledged_amount) || 0,
      paid_amount: parseFloat(form.paid_amount) || 0,
      in_kind: form.in_kind.trim() || null,
      notes: form.notes.trim() || null,
    };
    await saveDonor(editingId ? { ...payload, id: editingId } : payload);
    toast({ title: editingId ? "تم التعديل" : "تمت الإضافة" });
    setDialogOpen(false);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا الداعم؟")) return;
    await deleteDonorLocal(id);
    toast({ title: "تم الحذف", variant: "destructive" });
    await load();
  };

  const printDonorReport = async (d: Donor) => {
    const [awardsData, expData] = await Promise.all([
      loadAwards(currentYear),
      loadCeremonyExpenses(currentYear),
    ]);
    const awards = ((awardsData as unknown as Record<string, unknown>[]) || []).filter(
      (a) => (a.funded_by as string) === d.name,
    );
    const expenses = ((expData as unknown as Record<string, unknown>[]) || []).filter(
      (e) => (e.funded_by as string) === d.name,
    );
    const awardsTotal = awards.reduce((s, a) => s + Number(a.amount || 0), 0);
    const expTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

    const rows = (list: Record<string, unknown>[], cols: string[]) =>
      list
        .map(
          (r) =>
            `<tr>${cols.map((c) => `<td>${esc(String(r[c] ?? "—") || "—")}</td>`).join("")}</tr>`,
        )
        .join("");

    const html = `<h1>تقرير الداعم</h1>
      <div class="sub">${esc(d.name)} — عام ${esc(currentYear)}هـ</div>
      <div class="cards">
        <div class="card"><span>المبلغ المتعهد</span><b>${riyal(d.pledged_amount)}</b></div>
        <div class="card"><span>المبلغ المستلم</span><b>${riyal(d.paid_amount)}</b></div>
        <div class="card"><span>المتبقي</span><b>${riyal(Number(d.pledged_amount) - Number(d.paid_amount))}</b></div>
        <div class="card"><span>ما صُرف من دعمه</span><b>${riyal(awardsTotal + expTotal)}</b></div>
      </div>
      ${d.in_kind ? `<p><strong>الدعم العيني:</strong> ${esc(d.in_kind)}</p>` : ""}
      <h2>الإكراميات والجوائز المموّلة (${awards.length})</h2>
      ${
        awards.length
          ? `<table><thead><tr><th>المستفيد</th><th>الفئة</th><th>النوع</th><th>المبلغ</th><th>الجائزة العينية</th></tr></thead><tbody>${awards
              .map(
                (a) =>
                  `<tr><td>${esc(String(a.recipient_name))}</td><td>${esc(String(a.recipient_type))}</td><td>${
                    a.award_kind === "cash" ? "نقدية" : "عينية"
                  }</td><td class="num">${riyal(Number(a.amount || 0))}</td><td>${esc(
                    String(a.item ?? "—") || "—",
                  )}</td></tr>`,
              )
              .join("")}</tbody><tfoot><tr><td colspan="3">المجموع</td><td class="num">${riyal(
              awardsTotal,
            )}</td><td></td></tr></tfoot></table>`
          : '<div class="empty">لا توجد سجلات</div>'
      }
      <h2>مصروفات الحفل المموّلة (${expenses.length})</h2>
      ${
        expenses.length
          ? `<table><thead><tr><th>البند</th><th>الوصف</th><th>المبلغ</th><th>التاريخ</th></tr></thead><tbody>${rows(
              expenses,
              ["category", "description", "amount", "spent_at"],
            )}</tbody><tfoot><tr><td colspan="2">المجموع</td><td class="num">${riyal(
              expTotal,
            )}</td><td></td></tr></tfoot></table>`
          : '<div class="empty">لا توجد سجلات</div>'
      }
      <p class="thanks">جزاكم الله خيراً وبارك في أموالكم وأهليكم على دعمكم لحلقات تحفيظ القرآن الكريم.</p>`;
    printHtml(`تقرير الداعم ${d.name}`, html);
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
              <HeartHandshake className="h-6 w-6" /> الداعمون وفاعلو الخير
            </h1>
            <p className="text-sm opacity-90 mt-1">عام {currentYear}هـ</p>
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
          <Button onClick={openAdd} className="gap-1">
            <Plus className="h-4 w-4" /> إضافة داعم
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="rounded-[1.5rem] border border-white/70 bg-card/90 p-4 text-center shadow-lg shadow-primary/5">
            <div className="text-xs text-muted-foreground">إجمالي التعهدات</div>
            <div className="text-lg font-bold text-primary">
              {totals.pledged.toLocaleString()} ريال
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-white/70 bg-card/90 p-4 text-center shadow-lg shadow-primary/5">
            <div className="text-xs text-muted-foreground">إجمالي المستلم</div>
            <div className="text-lg font-bold text-emerald-600">
              {totals.paid.toLocaleString()} ريال
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-white/70 bg-card/90 p-4 text-center shadow-lg shadow-primary/5">
            <div className="text-xs text-muted-foreground">المتبقي</div>
            <div className="text-lg font-bold text-amber-600">
              {(totals.pledged - totals.paid).toLocaleString()} ريال
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
        ) : donors.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">لا يوجد داعمون لهذا العام</div>
        ) : (
          <div className="overflow-x-auto rounded-[1.5rem] border border-white/70 bg-card/90 shadow-xl shadow-primary/5">
            <table className="w-full text-sm">
              <thead className="bg-primary/5">
                <tr>
                  <th className="px-3 py-2 text-right">#</th>
                  <th className="px-3 py-2 text-right">الاسم</th>
                  <th className="px-3 py-2 text-center">النوع</th>
                  <th className="px-3 py-2 text-center">الجوال</th>
                  <th className="px-3 py-2 text-center">المتعهد</th>
                  <th className="px-3 py-2 text-center">المستلم</th>
                  <th className="px-3 py-2 text-right">الدعم العيني</th>
                  <th className="px-3 py-2 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {donors.map((d, i) => (
                  <tr key={d.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{d.name}</td>
                    <td className="px-3 py-2 text-center">
                      {d.donor_type === "company" ? "جهة/مؤسسة" : "فرد"}
                    </td>
                    <td className="px-3 py-2 text-center">{d.phone || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      {Number(d.pledged_amount).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-primary">
                      {Number(d.paid_amount).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{d.in_kind || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void printDonorReport(d)}
                        >
                          <Printer className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => openEdit(d)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => void remove(d.id)}>
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
            <DialogTitle>{editingId ? "تعديل داعم" : "إضافة داعم"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">الاسم</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">النوع</label>
                <Select
                  value={form.donor_type}
                  onValueChange={(v) => setForm({ ...form, donor_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="person">فرد</SelectItem>
                    <SelectItem value="company">جهة/مؤسسة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">الجوال</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">المبلغ المتعهد</label>
                <Input
                  type="number"
                  value={form.pledged_amount}
                  onChange={(e) => setForm({ ...form, pledged_amount: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">المبلغ المستلم</label>
                <Input
                  type="number"
                  value={form.paid_amount}
                  onChange={(e) => setForm({ ...form, paid_amount: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">الدعم العيني</label>
              <Input
                value={form.in_kind}
                onChange={(e) => setForm({ ...form, in_kind: e.target.value })}
                placeholder="مثال: 50 مصحف، هدايا، ضيافة الحفل"
              />
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

export default Donors;
