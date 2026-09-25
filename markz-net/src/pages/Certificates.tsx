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
  ScrollText,
  Plus,
  Pencil,
  Trash2,
  Save,
  Printer,
  Calendar,
  Wand2,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { START_YEAR, END_YEAR, Student } from "@/types/student";
import { RecallStudents } from "@/components/RecallStudents";
import {
  getActiveYear,
  setActiveYear,
  loadAllStudentsWithData,
  loadCertificates,
  saveCertificate,
  saveCertificates,
  deleteCertificateLocal,
  loadTeachers,
  loadDonors,
} from "@/utils/storage";
import { esc } from "@/utils/report";

interface Certificate {
  id: string;
  year: string;
  recipient_type: string;
  recipient_name: string;
  cert_type: string;
  title: string;
  notes: string | null;
  issued_at: string;
}

const CERT_TYPES: Record<string, string> = {
  khatm: "شهادة تقدير للخاتمين",
  excellence: "شهادة تميّز",
  participation: "شهادة مشاركة",
  thanks: "شهادة شكر لفاعلي الخير",
};

const RECIPIENTS: Record<string, string> = {
  student: "طالب/ة/طالب",
  teacher: "معلم/ة/معلم",
  donor: "داعم",
  other: "أخرى",
};

const CERT_BODY: Record<string, string> = {
  khatm: "تقديراً لجهودكم المباركة وإتمامكم حفظ كتاب الله عز وجل كاملاً",
  excellence: "تقديراً لتميّزكم وتفوّقكم في المسابقة الرمضانية لحفظ القرآن الكريم",
  participation: "تقديراً لمشاركتكم الفاعلة وجهودكم في تحفيظ كتاب الله عز وجل",
  thanks: "شكراً وتقديراً لدعمكم السخي ورعايتكم لبرامج تحفيظ القرآن الكريم",
};

const Certificates = () => {
  const { toast } = useToast();
  const [currentYear, setCurrentYear] = useState("");
  const [rows, setRows] = useState<Certificate[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<string[]>([]);
  const [donors, setDonors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    recipient_type: "student",
    recipient_name: "",
    cert_type: "khatm",
    title: "",
    notes: "",
    issued_at: new Date().toISOString().slice(0, 10),
  });

  const load = useCallback(async () => {
    if (!currentYear) return;
    setLoading(true);
    const list = await loadAllStudentsWithData(currentYear);
    setStudents(list);
    const [data, tData, dData] = await Promise.all([
      loadCertificates(currentYear),
      loadTeachers(currentYear),
      loadDonors(currentYear),
    ]);
    setRows((data as Certificate[]) || []);
    const t = new Set<string>();
    (tData || []).forEach((r) => t.add(r.name));
    list.forEach((s) => {
      const n = (s.teacher || "").trim();
      if (n) t.add(n);
    });
    setTeachers(Array.from(t).sort((a, b) => a.localeCompare(b, "ar")));
    setDonors((dData || []).map((d) => d.name));
    setLoading(false);
  }, [currentYear]);

  useEffect(() => {
    void (async () => setCurrentYear(await getActiveYear()))();
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const khatimat = useMemo(
    () =>
      students
        .filter((s) => parseFloat(s.yearData?.totalHifz || "0") >= 30)
        .map((s) => s.name)
        .filter(Boolean),
    [students],
  );

  const nameOptions = useMemo(() => {
    if (form.recipient_type === "teacher") return teachers;
    if (form.recipient_type === "donor") return donors;
    if (form.recipient_type === "student") return students.map((s) => s.name).filter(Boolean);
    return [];
  }, [form.recipient_type, teachers, donors, students]);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      recipient_type: "student",
      recipient_name: "",
      cert_type: "khatm",
      title: "",
      notes: "",
      issued_at: new Date().toISOString().slice(0, 10),
    });
    setDialogOpen(true);
  };

  const openEdit = (c: Certificate) => {
    setEditingId(c.id);
    setForm({
      recipient_type: c.recipient_type,
      recipient_name: c.recipient_name,
      cert_type: c.cert_type,
      title: c.title,
      notes: c.notes || "",
      issued_at: c.issued_at,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.recipient_name.trim()) {
      toast({ title: "اسم المستفيد مطلوب", variant: "destructive" });
      return;
    }
    const payload = {
      year: currentYear,
      recipient_type: form.recipient_type,
      recipient_name: form.recipient_name.trim(),
      cert_type: form.cert_type,
      title: form.title.trim() || CERT_TYPES[form.cert_type],
      notes: form.notes.trim() || null,
      issued_at: form.issued_at,
    };
    await saveCertificate(editingId ? { ...payload, id: editingId } : payload);
    toast({ title: editingId ? "تم التعديل" : "تمت الإضافة" });
    setDialogOpen(false);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذه الشهادة؟")) return;
    await deleteCertificateLocal(id);
    toast({ title: "تم الحذف", variant: "destructive" });
    await load();
  };

  const generate = async () => {
    const existing = new Set(rows.map((r) => `${r.recipient_name}|${r.cert_type}`));
    const today = new Date().toISOString().slice(0, 10);
    const payload = [
      ...khatimat
        .filter((n) => !existing.has(`${n}|khatm`))
        .map((n) => ({ recipient_type: "student", recipient_name: n, cert_type: "khatm" })),
      ...teachers
        .filter((n) => !existing.has(`${n}|participation`))
        .map((n) => ({ recipient_type: "teacher", recipient_name: n, cert_type: "participation" })),
    ].map((p) => ({
      ...p,
      year: currentYear,
      title: CERT_TYPES[p.cert_type],
      issued_at: today,
    }));
    if (!payload.length) {
      toast({ title: "لا توجد شهادات جديدة للتوليد" });
      return;
    }
    await saveCertificates(payload);
    toast({ title: `تم توليد ${payload.length} شهادة` });
    await load();
  };

  const certHtml = (c: Certificate) => `
    <div class="cert">
      <div class="frame">
        <img class="logo" src="${new URL(logo, window.location.origin).href}" alt="" />
        <div class="kicker">مركز تحفيظ القرآن الكريم</div>
        <div class="title">${esc(c.title || CERT_TYPES[c.cert_type] || "شهادة")}</div>
        <div class="rule"></div>
        <div class="pre">تُمنح هذه الشهادة إلى</div>
        <div class="name">${esc(c.recipient_name)}</div>
        <div class="body">${esc(CERT_BODY[c.cert_type] || "")}${c.notes ? `<br/>${esc(c.notes)}` : ""}</div>
        <div class="verse">﴿ وَقُل رَّبِّ زِدْنِي عِلْمًا ﴾</div>
        <div class="foot">
          <div><span>العام</span><b>${esc(c.year)}هـ</b></div>
          <div><span>التاريخ</span><b>${esc(c.issued_at)}</b></div>
          <div><span>التوقيع</span><b>........................</b></div>
        </div>
      </div>
    </div>`;

  const printCerts = async (list: Certificate[]) => {
    const { printHtmlDocument } = await import("@/utils/nativePrint");
    if (!list.length) return;
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>شهادات ${esc(currentYear)}</title><style>
      *{box-sizing:border-box}
      body{margin:0;font-family:'Traditional Arabic','Tahoma',sans-serif;color:#123}
      .cert{width:297mm;height:209mm;padding:10mm;page-break-after:always;display:flex}
      .frame{flex:1;border:3px double #0e6b3a;border-radius:10px;position:relative;
        padding:14mm 18mm;text-align:center;background:
        radial-gradient(circle at top right,rgba(197,164,80,.12),transparent 45%),
        radial-gradient(circle at bottom left,rgba(14,107,58,.10),transparent 45%),#fffdf7;
        outline:1px solid #c5a450;outline-offset:6px}
      .logo{height:22mm;margin-bottom:4mm}
      .kicker{letter-spacing:2px;color:#7a6a3a;font-size:15pt}
      .title{font-size:32pt;font-weight:bold;color:#0e6b3a;margin:2mm 0}
      .rule{width:60%;height:2px;margin:3mm auto;background:linear-gradient(90deg,transparent,#c5a450,transparent)}
      .pre{font-size:14pt;color:#555}
      .name{font-size:26pt;font-weight:bold;color:#123;margin:3mm 0 4mm;border-bottom:2px dotted #c5a450;display:inline-block;padding:0 12mm 2mm}
      .body{font-size:15pt;line-height:1.9;color:#333;max-width:210mm;margin:0 auto}
      .verse{margin-top:6mm;font-size:16pt;color:#0e6b3a}
      .foot{position:absolute;bottom:12mm;left:18mm;right:18mm;display:flex;justify-content:space-between;font-size:12pt}
      .foot span{display:block;color:#777;font-size:10pt}
      @media print{@page{size:A4 landscape;margin:0}.cert{page-break-after:always}}
      </style></head><body>${list.map(certHtml).join("")}
      </body></html>`;
    printHtmlDocument(html, `شهادات_${currentYear}`);
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
              <ScrollText className="h-6 w-6" /> الشهادات
            </h1>
            <p className="text-sm opacity-90 mt-1">
              عام {currentYear}هـ — {rows.length} شهادة
            </p>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-7 space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
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
            <RecallStudents
              targetYear={currentYear}
              onRecalled={load}
              buttonClassName="h-9 gap-1.5 rounded-xl text-xs font-bold"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="gap-1" onClick={() => void generate()}>
              <Wand2 className="h-4 w-4" /> توليد للخاتمات والمعلمين والمعلمات
            </Button>
            <Button variant="outline" className="gap-1" onClick={() => printCerts(rows)}>
              <Printer className="h-4 w-4" /> طباعة الكل
            </Button>
            <Button className="gap-1" onClick={openAdd}>
              <Plus className="h-4 w-4" /> إضافة
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">لا توجد شهادات لهذا العام</div>
        ) : (
          <div className="overflow-x-auto rounded-[1.5rem] border border-white/70 bg-card/90 shadow-xl shadow-primary/5">
            <table className="w-full text-sm">
              <thead className="bg-primary/5">
                <tr>
                  <th className="px-3 py-2 text-right">#</th>
                  <th className="px-3 py-2 text-right">الاسم</th>
                  <th className="px-3 py-2 text-center">الفئة</th>
                  <th className="px-3 py-2 text-right">نوع الشهادة</th>
                  <th className="px-3 py-2 text-center">التاريخ</th>
                  <th className="px-3 py-2 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{c.recipient_name}</td>
                    <td className="px-3 py-2 text-center">
                      {RECIPIENTS[c.recipient_type] || c.recipient_type}
                    </td>
                    <td className="px-3 py-2">{c.title || CERT_TYPES[c.cert_type]}</td>
                    <td className="px-3 py-2 text-center text-xs">{c.issued_at}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" variant="outline" onClick={() => printCerts([c])}>
                          <Printer className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => void remove(c.id)}>
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
            <DialogTitle>{editingId ? "تعديل شهادة" : "إضافة شهادة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">فئة المستفيد</label>
                <Select
                  value={form.recipient_type}
                  onValueChange={(v) => setForm({ ...form, recipient_type: v, recipient_name: "" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RECIPIENTS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">نوع الشهادة</label>
                <Select
                  value={form.cert_type}
                  onValueChange={(v) => setForm({ ...form, cert_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CERT_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">الاسم</label>
              {nameOptions.length > 0 ? (
                <Select
                  value={form.recipient_name}
                  onValueChange={(v) => setForm({ ...form, recipient_name: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الاسم" />
                  </SelectTrigger>
                  <SelectContent>
                    {nameOptions.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form.recipient_name}
                  onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">عنوان الشهادة</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={CERT_TYPES[form.cert_type]}
                />
              </div>
              <div>
                <label className="text-sm font-medium">التاريخ</label>
                <Input
                  type="date"
                  value={form.issued_at}
                  onChange={(e) => setForm({ ...form, issued_at: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">سطر إضافي في الشهادة</label>
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

export default Certificates;
