import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Gift, Pencil, Plus, Printer, Save, Trash2 } from "lucide-react";
import { deleteAwardLocal, saveAward, type AwardRow } from "@/utils/storage";
import {
  YEARS,
  amount,
  annualTotalFor,
  formatAmount,
  isTeacherRecipient,
  mergeTeacherNames,
  monthlyTotalFor,
  todayIso,
  type TeacherTabProps,
} from "./shared";

/**
 * تبويب الإكراميات السنوية: سجلات الإكرامية السنوية لكل معلم/ة في العام
 * المختار (تُخزَّن في جدول الجوائز بنوع «إكرامية سنوية» فتظهر أيضاً في صفحة
 * الإكراميات والجوائز)، مع ملخص يجمع الشهرية + السنوية لكل معلم/ة.
 */
export function AnnualBonusesTab({
  teachers,
  bonuses,
  awards,
  defaultYear,
  readOnly,
  onChanged,
}: TeacherTabProps) {
  const { toast } = useToast();
  // العام المختار محلياً لهذا التبويب: يبدأ بالعام النشط في النظام، ولا يقيّد
  // السجل العام للمعلمين والمعلمات (فهو لكل الأعوام).
  const [yearInput, setYear] = useState("");
  const year = yearInput || defaultYear || YEARS[YEARS.length - 1];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    recipient_name: "",
    amount: "0",
    awarded_at: todayIso(),
    funded_by: "",
    notes: "",
  });

  const rows = useMemo(
    () =>
      awards
        .filter(
          (award) =>
            award.award_type === "annual" &&
            isTeacherRecipient(award.recipient_type) &&
            award.year === year,
        )
        .sort((a, b) => (b.awarded_at || "").localeCompare(a.awarded_at || "")),
    [awards, year],
  );

  const names = useMemo(
    () =>
      mergeTeacherNames(
        teachers.map((teacher) => teacher.name),
        rows.map((row) => row.recipient_name),
      ),
    [rows, teachers],
  );

  const summary = useMemo(
    () =>
      names
        .map((name) => ({
          name,
          annual: annualTotalFor(awards, name, year),
          monthly: monthlyTotalFor(bonuses, name, year),
        }))
        .filter((row) => row.annual > 0 || row.monthly > 0)
        .sort((a, b) => b.annual + b.monthly - (a.annual + a.monthly)),
    [awards, bonuses, names, year],
  );

  const yearTotal = rows.reduce((sum, row) => sum + amount(row.amount), 0);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      recipient_name: names[0] || "",
      amount: "0",
      awarded_at: todayIso(),
      funded_by: "",
      notes: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (row: AwardRow) => {
    setEditingId(row.id);
    setForm({
      recipient_name: row.recipient_name,
      amount: String(amount(row.amount)),
      awarded_at: row.awarded_at || todayIso(),
      funded_by: row.funded_by || "",
      notes: row.notes || "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const name = form.recipient_name.trim();
    if (!name) {
      toast({ title: "اسم المعلم/ة مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveAward({
        ...(editingId ? { id: editingId } : {}),
        year,
        recipient_type: "teacher",
        recipient_name: name,
        award_type: "annual",
        award_kind: "cash",
        amount: amount(form.amount),
        item: null,
        student_name: null,
        notes: form.notes.trim() || null,
        awarded_at: form.awarded_at,
        funded_by: form.funded_by.trim() || null,
      });
      toast({
        title: editingId ? "تم التعديل" : "تمت الإضافة",
        description: `${name} — إكرامية سنوية ${year}هـ`,
      });
      setDialogOpen(false);
      await onChanged();
    } catch (error) {
      console.error(error);
      toast({ title: "تعذر الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: AwardRow) => {
    if (!confirm(`حذف الإكرامية السنوية لـ «${row.recipient_name}»؟`)) return;
    try {
      await deleteAwardLocal(row.id);
      toast({ title: "تم الحذف", variant: "destructive" });
      await onChanged();
    } catch (error) {
      console.error(error);
      toast({ title: "تعذر الحذف", variant: "destructive" });
    }
  };

  const printReport = async () => {
    const { printHtmlDocument } = await import("@/utils/nativePrint");
    const esc = (value: string) =>
      (value || "").replace(
        /[&<>"']/g,
        (c) =>
          ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
      );
    const rowsHtml = summary
      .map(
        (row) => `<tr>
          <td>${esc(row.name)}</td>
          <td class="num">${row.monthly.toLocaleString()}</td>
          <td class="num">${row.annual.toLocaleString()}</td>
          <td class="num total">${(row.monthly + row.annual).toLocaleString()}</td>
        </tr>`,
      )
      .join("");
    const detailsHtml = rows
      .map(
        (row) => `<tr>
          <td>${esc(row.recipient_name)}</td>
          <td class="num">${amount(row.amount).toLocaleString()}</td>
          <td>${esc(row.awarded_at || "—")}</td>
          <td>${esc(row.funded_by || "—")}</td>
          <td>${esc(row.notes || "—")}</td>
        </tr>`,
      )
      .join("");
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>الإكراميات السنوية - ${esc(year)}هـ</title>
      <style>
        body{font-family:'Traditional Arabic','Tahoma',sans-serif;direction:rtl;padding:24px;color:#222}
        h1{text-align:center;color:#0e6b3a;margin:0 0 4px}
        h2{color:#0e6b3a;border-bottom:2px solid #0e6b3a;padding-bottom:4px;margin-top:26px}
        .sub{text-align:center;color:#666;margin-bottom:18px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{border:1px solid #999;padding:6px 8px;text-align:right}
        th{background:#0e6b3a;color:#fff}
        .num{text-align:center;font-variant-numeric:tabular-nums}
        .total{font-weight:bold;background:#f4faf6}
        @media print{@page{size:A4;margin:12mm}}
      </style></head><body>
      <h1>الإكراميات السنوية للمعلمين والمعلمات</h1>
      <div class="sub">عام ${esc(year)}هـ — إجمالي الإكراميات السنوية: ${yearTotal.toLocaleString()} ريال</div>
      <h2>ملخص كل معلم/ة (الشهرية + السنوية)</h2>
      ${
        rowsHtml
          ? `<table><thead><tr><th>المعلم/ة</th><th>الإكراميات الشهرية</th><th>الإكراميات السنوية</th><th>المجموع</th></tr></thead><tbody>${rowsHtml}</tbody></table>`
          : '<div style="text-align:center;color:#888">لا توجد بيانات</div>'
      }
      <h2>تفصيل الإكراميات السنوية</h2>
      ${
        detailsHtml
          ? `<table><thead><tr><th>المعلم/ة</th><th>المبلغ</th><th>التاريخ</th><th>الجهة الممولة</th><th>ملاحظات</th></tr></thead><tbody>${detailsHtml}</tbody></table>`
          : '<div style="text-align:center;color:#888">لا توجد سجلات</div>'
      }
      </body></html>`;
    printHtmlDocument(html, `الإكراميات_السنوية_${year}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-card/85 p-3 shadow-md backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">العام</span>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="h-9 w-28 rounded-xl">
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
          </div>
          <Badge variant="secondary" className="rounded-full">
            {rows.length} إكرامية سنوية
          </Badge>
          <Badge variant="secondary" className="rounded-full">
            الإجمالي: {formatAmount(yearTotal)} ريال
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-xl text-xs"
            onClick={() => void printReport()}
          >
            <Printer className="h-3.5 w-3.5" /> طباعة
          </Button>
          <Button
            size="sm"
            className="h-9 gap-1.5 rounded-xl text-xs"
            onClick={openAdd}
            disabled={readOnly || names.length === 0}
          >
            <Plus className="h-3.5 w-3.5" /> إضافة إكرامية سنوية
          </Button>
        </div>
      </div>

      {readOnly && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-100/80 p-3 text-sm text-amber-900">
          وضع الاطلاع للقراءة فقط: لا يمكن تعديل الإكراميات السنوية.
        </div>
      )}

      {summary.length > 0 && (
        <div className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-card/90 shadow-xl shadow-primary/5">
          <div className="border-b bg-muted/40 px-3 py-2 text-sm font-bold">
            ملخص العام {year}هـ — الإكراميات الشهرية والسنوية لكل معلم/ة
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary/5">
                <tr>
                  <th className="px-3 py-2 text-right">#</th>
                  <th className="px-3 py-2 text-right">المعلم/ة</th>
                  <th className="px-3 py-2 text-center">الإكراميات الشهرية</th>
                  <th className="px-3 py-2 text-center">الإكراميات السنوية</th>
                  <th className="px-3 py-2 text-center">المجموع</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row, index) => (
                  <tr key={row.name} className="border-t border-border hover:bg-muted/40">
                    <td className="px-3 py-2 text-right font-bold">{index + 1}</td>
                    <td className="px-3 py-2 text-right font-semibold">{row.name}</td>
                    <td className="px-3 py-2 text-center text-emerald-700">
                      {formatAmount(row.monthly)}
                    </td>
                    <td className="px-3 py-2 text-center text-amber-700">
                      {formatAmount(row.annual)}
                    </td>
                    <td className="px-3 py-2 text-center font-bold">
                      {formatAmount(row.monthly + row.annual)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/60 font-bold">
                <tr>
                  <td className="px-3 py-2" colSpan={2}>
                    الإجمالي
                  </td>
                  <td className="px-3 py-2 text-center">
                    {formatAmount(summary.reduce((sum, row) => sum + row.monthly, 0))}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {formatAmount(summary.reduce((sum, row) => sum + row.annual, 0))}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {formatAmount(summary.reduce((sum, row) => sum + row.monthly + row.annual, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-card/90 shadow-xl shadow-primary/5">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 text-sm font-bold">
          <Gift className="h-4 w-4 text-amber-600" /> سجلات الإكرامية السنوية لعام {year}هـ
        </div>
        {rows.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            لا توجد إكراميات سنوية محفوظة لعام {year}هـ.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary/5">
                <tr>
                  <th className="px-3 py-2 text-right">#</th>
                  <th className="px-3 py-2 text-right">المعلم/ة</th>
                  <th className="px-3 py-2 text-center">المبلغ (ريال)</th>
                  <th className="px-3 py-2 text-center">التاريخ</th>
                  <th className="px-3 py-2 text-right">الجهة الممولة</th>
                  <th className="px-3 py-2 text-right">ملاحظات</th>
                  <th className="px-3 py-2 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-3 py-2 text-right">{index + 1}</td>
                    <td className="px-3 py-2 text-right font-semibold">{row.recipient_name}</td>
                    <td className="px-3 py-2 text-center font-bold text-primary">
                      {formatAmount(row.amount)}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">{row.awarded_at || "—"}</td>
                    <td className="px-3 py-2 text-right">{row.funded_by || "—"}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {row.notes || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-center gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8"
                          disabled={readOnly}
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8"
                          disabled={readOnly}
                          onClick={() => void remove(row)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-amber-600" />
              {editingId ? "تعديل إكرامية سنوية" : "إضافة إكرامية سنوية"} — {year}هـ
            </DialogTitle>
            <DialogDescription>
              تُحفظ في سجلات الإكراميات السنوية لنفس العام، وتظهر أيضاً في صفحة الإكراميات والجوائز.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-bold">اسم المعلم/ة</label>
                <Select
                  value={form.recipient_name}
                  onValueChange={(value) => setForm({ ...form, recipient_name: value })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="اختر من السجل العام" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[50vh]">
                    {names.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold">المبلغ (ريال)</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold">التاريخ</label>
                <Input
                  type="date"
                  value={form.awarded_at}
                  onChange={(event) => setForm({ ...form, awarded_at: event.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold">الجهة الممولة (اختياري)</label>
                <Input
                  value={form.funded_by}
                  onChange={(event) => setForm({ ...form, funded_by: event.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold">ملاحظات</label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={() => void save()} disabled={saving || !form.recipient_name.trim()}>
              <Save className="h-4 w-4" /> {saving ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
