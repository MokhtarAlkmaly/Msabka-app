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
import { Pencil, Plus, Printer, Save, ScrollText, Trash2, Wand2 } from "lucide-react";
import logo from "@/assets/logo.png";
import {
  deleteCertificateLocal,
  saveCertificate,
  saveCertificates,
  type CertificateRow,
} from "@/utils/storage";
import {
  TEACHER_RECIPIENT_LABEL,
  YEARS,
  isTeacherRecipient,
  mergeTeacherNames,
  todayIso,
  type TeacherTabProps,
} from "./shared";

/** أنواع شهادات التقدير (نفس أنواع صفحة الشهادات العامة). */
const CERT_TYPES: Record<string, string> = {
  thanks: "شهادة شكر وتقدير",
  participation: "شهادة مشاركة فاعلة",
  excellence: "شهادة تميّز",
  khatm: "شهادة إتمام حفظ",
};

const CERT_BODY: Record<string, string> = {
  thanks: "شكراً وتقديراً لجهودكم المباركة في خدمة كتاب الله عز وجل وتعليمه",
  participation: "تقديراً لمشاركتكم الفاعلة وجهودكم في تحفيظ كتاب الله عز وجل",
  excellence: "تقديراً لتميّزكم وأدائكم المتميز في حلقات تحفيظ القرآن الكريم",
  khatm: "تقديراً لجهودكم في إتمام حفظ كتاب الله عز وجل وتعليمه",
};

const esc = (value: string) =>
  (value || "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

/**
 * تبويب شهادات التقدير للمعلمين والمعلمات: حفظ وإصدار الشهادات لكل عام، مع
 * توليد جماعي لكل من في السجل العام، وطباعة الشهادات بتصميم جاهز.
 */
export function TeacherCertificatesTab({
  teachers,
  certificates,
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
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    recipient_name: "",
    cert_type: "thanks",
    title: "",
    issued_at: todayIso(),
    notes: "",
  });

  const rows = useMemo(
    () =>
      certificates
        .filter(
          (certificate) =>
            isTeacherRecipient(certificate.recipient_type) && certificate.year === year,
        )
        .sort((a, b) => a.recipient_name.localeCompare(b.recipient_name, "ar")),
    [certificates, year],
  );

  const names = useMemo(
    () =>
      mergeTeacherNames(
        teachers.map((teacher) => teacher.name),
        rows.map((row) => row.recipient_name),
      ),
    [rows, teachers],
  );

  const openAdd = (name = "") => {
    setEditingId(null);
    setForm({
      recipient_name: name || names[0] || "",
      cert_type: "thanks",
      title: "",
      issued_at: todayIso(),
      notes: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (row: CertificateRow) => {
    setEditingId(row.id);
    setForm({
      recipient_name: row.recipient_name,
      cert_type: row.cert_type,
      title: row.title || "",
      issued_at: row.issued_at || todayIso(),
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
      await saveCertificate({
        ...(editingId ? { id: editingId } : {}),
        year,
        recipient_type: "teacher",
        recipient_name: name,
        cert_type: form.cert_type,
        title: form.title.trim() || CERT_TYPES[form.cert_type],
        notes: form.notes.trim() || null,
        issued_at: form.issued_at,
      });
      toast({
        title: editingId ? "تم التعديل" : "تمت الإضافة",
        description: `${name} — ${year}هـ`,
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

  const remove = async (row: CertificateRow) => {
    if (!confirm(`حذف شهادة «${row.recipient_name}»؟`)) return;
    try {
      await deleteCertificateLocal(row.id);
      toast({ title: "تم الحذف", variant: "destructive" });
      await onChanged();
    } catch (error) {
      console.error(error);
      toast({ title: "تعذر الحذف", variant: "destructive" });
    }
  };

  /** توليد شهادة شكر لكل من في السجل العام ولم تصدر له شهادة هذا العام. */
  const generateAll = async () => {
    const existing = new Set(
      certificates
        .filter((certificate) => isTeacherRecipient(certificate.recipient_type))
        .map(
          (certificate) =>
            `${certificate.recipient_name}|${certificate.cert_type}|${certificate.year}`,
        ),
    );
    const payload = teachers
      .map((teacher) => teacher.name)
      .filter((name) => !existing.has(`${name}|thanks|${year}`))
      .map((name) => ({
        year,
        recipient_type: "teacher",
        recipient_name: name,
        cert_type: "thanks",
        title: CERT_TYPES.thanks,
        issued_at: todayIso(),
      }));
    if (payload.length === 0) {
      toast({
        title: "لا توجد شهادات جديدة",
        description: `كل من في السجل العام له شهادة محفوظة لعام ${year}هـ.`,
      });
      return;
    }
    setGenerating(true);
    try {
      await saveCertificates(payload);
      toast({ title: `تم توليد ${payload.length} شهادة`, description: `عام ${year}هـ` });
      await onChanged();
    } catch (error) {
      console.error(error);
      toast({ title: "تعذر التوليد", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const certHtml = (certificate: CertificateRow) => `
    <div class="cert">
      <div class="frame">
        <img class="logo" src="${new URL(logo, window.location.origin).href}" alt="" />
        <div class="kicker">مركز إنماء الأهلي الخيري — قسم القرآن الكريم</div>
        <div class="title">${esc(certificate.title || CERT_TYPES[certificate.cert_type] || "شهادة تقدير")}</div>
        <div class="rule"></div>
        <div class="pre">تُمنح هذه الشهادة إلى</div>
        <div class="name">${esc(certificate.recipient_name)}</div>
        <div class="role">${esc(TEACHER_RECIPIENT_LABEL[certificate.recipient_type] || "معلم/ة")}</div>
        <div class="body">${esc(CERT_BODY[certificate.cert_type] || "")}${
          certificate.notes ? `<br/>${esc(certificate.notes)}` : ""
        }</div>
        <div class="verse">﴿ وَقُل رَّبِّ زِدْنِي عِلْمًا ﴾</div>
        <div class="foot">
          <div><span>العام</span><b>${esc(certificate.year)}هـ</b></div>
          <div><span>التاريخ</span><b>${esc(certificate.issued_at)}</b></div>
          <div><span>التوقيع</span><b>........................</b></div>
        </div>
      </div>
    </div>`;

  const printCertificates = async (list: CertificateRow[]) => {
    if (list.length === 0) return;
    const { printHtmlDocument } = await import("@/utils/nativePrint");
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>شهادات التقدير للمعلمين والمعلمات - ${esc(year)}هـ</title><style>
      *{box-sizing:border-box}
      body{margin:0;font-family:'Traditional Arabic','Tahoma',sans-serif;color:#123}
      .cert{width:297mm;height:209mm;padding:10mm;page-break-after:always;display:flex}
      .frame{flex:1;border:3px double #0e6b3a;border-radius:10px;position:relative;
        padding:14mm 18mm;text-align:center;background:
        radial-gradient(circle at top right,rgba(197,164,80,.12),transparent 45%),
        radial-gradient(circle at bottom left,rgba(14,107,58,.10),transparent 45%),#fffdf7;
        outline:1px solid #c5a450;outline-offset:6px}
      .logo{height:22mm;margin-bottom:4mm}
      .kicker{letter-spacing:2px;color:#7a6a3a;font-size:14pt}
      .title{font-size:30pt;font-weight:bold;color:#0e6b3a;margin:2mm 0}
      .rule{width:60%;height:2px;margin:3mm auto;background:linear-gradient(90deg,transparent,#c5a450,transparent)}
      .pre{font-size:14pt;color:#555}
      .name{font-size:26pt;font-weight:bold;color:#123;margin:3mm 0 1mm;border-bottom:2px dotted #c5a450;display:inline-block;padding:0 12mm 2mm}
      .role{font-size:13pt;color:#7a6a3a;margin-bottom:3mm}
      .body{font-size:15pt;line-height:1.9;color:#333;max-width:210mm;margin:0 auto}
      .verse{margin-top:6mm;font-size:16pt;color:#0e6b3a}
      .foot{position:absolute;bottom:12mm;left:18mm;right:18mm;display:flex;justify-content:space-between;font-size:12pt}
      .foot span{display:block;color:#777;font-size:10pt}
      @media print{@page{size:A4 landscape;margin:0}.cert{page-break-after:always}}
      </style></head><body>${list.map(certHtml).join("")}
      </body></html>`;
    printHtmlDocument(html, `شهادات_المعلمين_${year}`);
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
            {rows.length} شهادة محفوظة
          </Badge>
          <Badge variant="secondary" className="rounded-full">
            {teachers.length} في السجل العام
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-9 gap-1.5 rounded-xl text-xs"
            onClick={() => void generateAll()}
            disabled={readOnly || generating || teachers.length === 0}
          >
            <Wand2 className="h-3.5 w-3.5" />
            {generating ? "جارٍ التوليد..." : "توليد شهادة تقدير لكل من في السجل"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-xl text-xs"
            onClick={() => void printCertificates(rows)}
            disabled={rows.length === 0}
          >
            <Printer className="h-3.5 w-3.5" /> طباعة الكل
          </Button>
          <Button
            size="sm"
            className="h-9 gap-1.5 rounded-xl text-xs"
            onClick={() => openAdd()}
            disabled={readOnly || names.length === 0}
          >
            <Plus className="h-3.5 w-3.5" /> إضافة شهادة
          </Button>
        </div>
      </div>

      {readOnly && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-100/80 p-3 text-sm text-amber-900">
          وضع الاطلاع للقراءة فقط: لا يمكن إضافة أو تعديل الشهادات.
        </div>
      )}

      <div className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-card/90 shadow-xl shadow-primary/5">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 text-sm font-bold">
          <ScrollText className="h-4 w-4 text-emerald-600" /> شهادات تقدير المعلمين والمعلمات —{" "}
          {year}هـ
        </div>
        {rows.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            لا توجد شهادات محفوظة لعام {year}هـ. استخدم «توليد شهادة تقدير لكل من في السجل» أو أضف
            شهادة واحدة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary/5">
                <tr>
                  <th className="px-3 py-2 text-right">#</th>
                  <th className="px-3 py-2 text-right">الاسم</th>
                  <th className="px-3 py-2 text-right">عنوان الشهادة</th>
                  <th className="px-3 py-2 text-center">النوع</th>
                  <th className="px-3 py-2 text-center">التاريخ</th>
                  <th className="px-3 py-2 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-3 py-2 text-right">{index + 1}</td>
                    <td className="px-3 py-2 text-right font-semibold">{row.recipient_name}</td>
                    <td className="px-3 py-2 text-right">
                      {row.title || CERT_TYPES[row.cert_type] || row.cert_type}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      {TEACHER_RECIPIENT_LABEL[row.recipient_type] || row.recipient_type}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">{row.issued_at}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          title="طباعة الشهادة"
                          onClick={() => void printCertificates([row])}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
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
              <ScrollText className="h-5 w-5 text-emerald-600" />
              {editingId ? "تعديل شهادة تقدير" : "إضافة شهادة تقدير"} — {year}هـ
            </DialogTitle>
            <DialogDescription>
              تُحفظ الشهادة لعام {year}هـ وتظهر أيضاً في صفحة الشهادات العامة.
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
                <label className="text-sm font-bold">نوع الشهادة</label>
                <Select
                  value={form.cert_type}
                  onValueChange={(value) =>
                    setForm({ ...form, cert_type: value, title: CERT_TYPES[value] || "" })
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CERT_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold">عنوان الشهادة</label>
                <Input
                  value={form.title}
                  placeholder={CERT_TYPES[form.cert_type]}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold">التاريخ</label>
                <Input
                  type="date"
                  value={form.issued_at}
                  onChange={(event) => setForm({ ...form, issued_at: event.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold">سطر إضافي في الشهادة</label>
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
