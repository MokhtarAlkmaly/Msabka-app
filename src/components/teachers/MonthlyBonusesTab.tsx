import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Copy, Printer, Save, Wallet } from "lucide-react";
import { saveTeacherBonus } from "@/utils/storage";
import {
  HIJRI_MONTHS,
  YEARS,
  amount,
  formatAmount,
  mergeTeacherNames,
  studentsByTeacher,
  type TeacherTabProps,
} from "./shared";

/** الشهر الهجري الحالي (1-12) للتحديد الافتراضي. */
const currentHijriMonth = () => {
  try {
    const formatted = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      month: "numeric",
    }).format(new Date());
    const value = Number(formatted.replace(/[^\d]/g, ""));
    return value >= 1 && value <= 12 ? value : 1;
  } catch {
    return 1;
  }
};

/**
 * تبويب الإكراميات الشهرية: صف واحد لكل معلم/ة ومبلغ لكل شهر في العام
 * المختار — الحفظ فوري في قاعدة البيانات المحلية ثم المزامنة السحابية.
 */
export function MonthlyBonusesTab({
  teachers,
  students,
  bonuses,
  defaultYear,
  readOnly,
  onChanged,
}: TeacherTabProps) {
  const { toast } = useToast();
  // العام المختار محلياً لهذا التبويب: يبدأ بالعام النشط في النظام، ولا يقيّد
  // السجل العام للمعلمين والمعلمات (فهو لكل الأعوام).
  const [yearInput, setYear] = useState("");
  const year = yearInput || defaultYear || YEARS[YEARS.length - 1];
  const [month, setMonth] = useState(currentHijriMonth);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingName, setSavingName] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  // تُعاد القيم المعروضة من قاعدة البيانات بعد كل حفظ أو تغيير للعام/الشهر.
  useEffect(() => {
    setDraft({});
  }, [year, month, bonuses]);

  const studentsMap = useMemo(() => studentsByTeacher(students), [students]);
  const yearBonuses = useMemo(
    () => bonuses.filter((bonus) => bonus.year === year),
    [bonuses, year],
  );

  const names = useMemo(
    () =>
      mergeTeacherNames(
        teachers.map((teacher) => teacher.name),
        yearBonuses.map((bonus) => bonus.teacher_name),
      ),
    [teachers, yearBonuses],
  );

  const savedAmount = useCallback(
    (name: string) =>
      amount(
        bonuses.find(
          (bonus) => bonus.teacher_name === name && bonus.year === year && bonus.month === month,
        )?.amount,
      ),
    [bonuses, month, year],
  );

  const valueOf = (name: string) =>
    draft[name] ?? (savedAmount(name) ? String(savedAmount(name)) : "");

  const yearTotalFor = (name: string) =>
    yearBonuses
      .filter((bonus) => bonus.teacher_name === name)
      .reduce((sum, bonus) => sum + amount(bonus.amount), 0);

  const monthTotal = names.reduce((sum, name) => sum + amount(draft[name] ?? savedAmount(name)), 0);
  const yearTotal = yearBonuses.reduce((sum, bonus) => sum + amount(bonus.amount), 0);
  const paidCount = names.filter((name) => amount(draft[name] ?? savedAmount(name)) > 0).length;
  const dirtyNames = Object.keys(draft).filter((name) => {
    const next = amount(draft[name]);
    return next !== savedAmount(name);
  });

  const saveOne = async (name: string) => {
    setSavingName(name);
    try {
      await saveTeacherBonus({
        teacher_name: name,
        year,
        month,
        amount: amount(draft[name] ?? savedAmount(name)),
      });
      toast({
        title: "تم حفظ الإكرامية",
        description: `${name} — ${HIJRI_MONTHS[month - 1]} ${year}هـ`,
      });
      setDraft((current) => {
        const next = { ...current };
        delete next[name];
        return next;
      });
      await onChanged();
    } catch (error) {
      console.error(error);
      toast({ title: "تعذر الحفظ", variant: "destructive" });
    } finally {
      setSavingName(null);
    }
  };

  const saveAll = async () => {
    const targets = Object.keys(draft).filter((name) => amount(draft[name]) !== savedAmount(name));
    if (targets.length === 0) {
      toast({ title: "لا توجد تعديلات غير محفوظة" });
      return;
    }
    setSavingAll(true);
    try {
      for (const name of targets) {
        await saveTeacherBonus({
          teacher_name: name,
          year,
          month,
          amount: amount(draft[name]),
        });
      }
      toast({
        title: "تم حفظ التعديلات",
        description: `${targets.length} إكرامية — ${HIJRI_MONTHS[month - 1]} ${year}هـ`,
      });
      setDraft({});
      await onChanged();
    } catch (error) {
      console.error(error);
      toast({ title: "تعذر حفظ التعديلات", variant: "destructive" });
    } finally {
      setSavingAll(false);
    }
  };

  /** نقل مبالغ الشهر السابق كمسودة للمراجعة قبل الحفظ. */
  const copyPreviousMonth = () => {
    const previousMonth = month === 1 ? 12 : month - 1;
    const previousYear = month === 1 ? String(Number(year) - 1) : year;
    const next: Record<string, string> = {};
    names.forEach((name) => {
      const previous = bonuses.find(
        (bonus) =>
          bonus.teacher_name === name &&
          bonus.year === previousYear &&
          bonus.month === previousMonth,
      );
      if (previous && amount(previous.amount) > 0) next[name] = String(previous.amount);
    });
    if (Object.keys(next).length === 0) {
      toast({
        title: "لا توجد مبالغ للنسخ",
        description: `لا توجد إكراميات محفوظة لشهر ${HIJRI_MONTHS[previousMonth - 1]} ${previousYear}هـ`,
      });
      return;
    }
    setDraft(next);
    toast({
      title: "نُسخت مبالغ الشهر السابق",
      description: "راجع المبالغ ثم اضغط «حفظ كل التعديلات».",
    });
  };

  const printYearReport = async () => {
    const { printHtmlDocument } = await import("@/utils/nativePrint");
    const esc = (value: string) =>
      (value || "").replace(
        /[&<>"']/g,
        (c) =>
          ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
      );
    const rows = names
      .map((name) => {
        const cells = HIJRI_MONTHS.map((_, index) => {
          const total = yearBonuses
            .filter((bonus) => bonus.teacher_name === name && bonus.month === index + 1)
            .reduce((sum, bonus) => sum + amount(bonus.amount), 0);
          return `<td class="num">${total ? total.toLocaleString() : "—"}</td>`;
        }).join("");
        const total = yearTotalFor(name);
        return `<tr><td>${esc(name)}</td>${cells}<td class="num total">${total.toLocaleString()}</td></tr>`;
      })
      .join("");
    const totalsRow = HIJRI_MONTHS.map((_, index) => {
      const total = yearBonuses
        .filter((bonus) => bonus.month === index + 1)
        .reduce((sum, bonus) => sum + amount(bonus.amount), 0);
      return `<td class="num">${total ? total.toLocaleString() : "—"}</td>`;
    }).join("");
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>كشف الإكراميات الشهرية - ${esc(year)}هـ</title>
      <style>
        body{font-family:'Traditional Arabic','Tahoma',sans-serif;direction:rtl;padding:20px;color:#222}
        h1{text-align:center;color:#0e6b3a;margin:0 0 4px}
        .sub{text-align:center;color:#666;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #999;padding:4px 5px;text-align:right}
        th{background:#0e6b3a;color:#fff}
        .num{text-align:center;font-variant-numeric:tabular-nums}
        .total{font-weight:bold;background:#f4faf6}
        tfoot td{font-weight:bold;background:#eef7f1}
        @media print{@page{size:A4 landscape;margin:8mm}}
      </style></head><body>
      <h1>كشف الإكراميات الشهرية للمعلمين والمعلمات</h1>
      <div class="sub">عام ${esc(year)}هـ — الإجمالي: ${yearTotal.toLocaleString()} ريال</div>
      <table>
        <thead><tr><th>المعلم/ة</th>${HIJRI_MONTHS.map((m) => `<th>${esc(m)}</th>`).join("")}<th>المجموع</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="14">لا توجد بيانات</td></tr>`}</tbody>
        <tfoot><tr><td>الإجمالي</td>${totalsRow}<td class="num total">${yearTotal.toLocaleString()}</td></tr></tfoot>
      </table>
      </body></html>`;
    printHtmlDocument(html, `الإكراميات_الشهرية_${year}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-white/60 bg-card/85 p-3 shadow-md backdrop-blur">
        <div className="flex flex-wrap items-end gap-3">
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
          <div className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">الشهر</span>
            <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
              <SelectTrigger className="h-9 w-40 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HIJRI_MONTHS.map((label, index) => (
                  <SelectItem key={label} value={String(index + 1)}>
                    {index + 1} — {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 pb-0.5">
            <Badge variant="secondary" className="rounded-full">
              إجمالي الشهر: {formatAmount(monthTotal)} ريال
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              إجمالي {year}هـ: {formatAmount(yearTotal)} ريال
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              مستفيدون هذا الشهر: {paidCount}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-xl text-xs"
            onClick={copyPreviousMonth}
            disabled={readOnly}
          >
            <Copy className="h-3.5 w-3.5" /> نسخ مبالغ الشهر السابق
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-xl text-xs"
            onClick={() => void printYearReport()}
          >
            <Printer className="h-3.5 w-3.5" /> طباعة كشف العام
          </Button>
          <Button
            size="sm"
            className="h-9 gap-1.5 rounded-xl text-xs"
            onClick={() => void saveAll()}
            disabled={readOnly || savingAll || dirtyNames.length === 0}
          >
            <Save className="h-3.5 w-3.5" />
            {savingAll ? "جارٍ الحفظ..." : `حفظ كل التعديلات (${dirtyNames.length})`}
          </Button>
        </div>
      </div>

      {readOnly && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-100/80 p-3 text-sm text-amber-900">
          وضع الاطلاع للقراءة فقط: لا يمكن تعديل الإكراميات.
        </div>
      )}

      <div className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-card/90 shadow-xl shadow-primary/5">
        {names.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            أضف المعلمين والمعلمات إلى السجل العام أولاً، ثم أدخل إكرامياتهم الشهرية.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary text-primary-foreground">
                <tr>
                  <th className="px-3 py-3 text-right">#</th>
                  <th className="px-3 py-3 text-right">اسم المعلم/ة</th>
                  <th className="px-3 py-3 text-center">عدد الطلاب</th>
                  <th className="px-3 py-3 text-center">
                    إكرامية {HIJRI_MONTHS[month - 1]} {year}هـ
                  </th>
                  <th className="px-3 py-3 text-center">إجمالي {year}هـ</th>
                  <th className="px-3 py-3 text-center">عدد الأشهر المصروفة</th>
                  <th className="px-3 py-3 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {names.map((name, index) => {
                  const dirty = amount(draft[name]) !== savedAmount(name) && name in draft;
                  const monthsPaid = yearBonuses.filter(
                    (bonus) => bonus.teacher_name === name && amount(bonus.amount) > 0,
                  ).length;
                  return (
                    <tr key={name} className="border-t border-border hover:bg-muted/40">
                      <td className="px-3 py-2 text-right font-bold">{index + 1}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {name}
                        {!teachers.some((teacher) => teacher.name === name) && (
                          <span className="mr-2 text-[11px] font-bold text-amber-600">
                            (غير مضاف للسجل العام)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                        {(studentsMap.get(name) || []).length}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          value={valueOf(name)}
                          placeholder="0"
                          disabled={readOnly || savingName === name}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, [name]: event.target.value }))
                          }
                          className={`mx-auto h-9 w-28 rounded-xl text-center ${
                            dirty ? "border-amber-500 ring-1 ring-amber-400" : ""
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-emerald-700">
                        {formatAmount(yearTotalFor(name))}
                      </td>
                      <td className="px-3 py-2 text-center text-xs">
                        {monthsPaid ? `${monthsPaid} / 12` : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Button
                          size="sm"
                          variant={dirty ? "default" : "outline"}
                          className="h-8 gap-1 text-xs"
                          disabled={readOnly || savingName === name || !dirty}
                          onClick={() => void saveOne(name)}
                        >
                          <Save className="h-3.5 w-3.5" />
                          {savingName === name ? "..." : "حفظ"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/60 font-bold">
                <tr>
                  <td className="px-3 py-3" colSpan={3}>
                    <span className="flex items-center gap-1">
                      <Wallet className="h-4 w-4" /> الإجمالي
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">{formatAmount(monthTotal)} ريال</td>
                  <td className="px-3 py-3 text-center">{formatAmount(yearTotal)} ريال</td>
                  <td className="px-3 py-3 text-center" colSpan={2}>
                    {yearBonuses.filter((bonus) => amount(bonus.amount) > 0).length} إكرامية محفوظة
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        <CalendarDays className="ml-1 inline h-3.5 w-3.5" />
        اختر العام والشهر ثم أدخل مبلغ كل معلم/ة — لا حاجة لأي خطوة إضافية، القيم تُحفظ في
        الإكراميات الشهرية لنفس العام والشهر. زر «نسخ مبالغ الشهر السابق» يملأ المبالغ كمسودة
        لمراجعتها قبل الحفظ.
      </p>
    </div>
  );
}
