/**
 * وارد المعلمين والمعلمات — مراجعة ترسيلات المعلمين والمعلمات من بواباتهم:
 * مراجعة/تعديل/اعتماد (يُكتب في المتابعة الشهرية) /رفض، مع السجل الكامل
 * للتاريخ، ولوحة جانبية بعدد الطلاب المسجّلين والمنتظرين.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Inbox,
  ChevronDown,
  Loader2,
  Check,
  X,
  Pencil,
  Trash2,
  RotateCcw,
  Users,
  AlertCircle,
  FilePlus2,
  BadgeCheck,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { PortalFormFields } from "@/components/PortalFormFields";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  getActiveYear,
  loadStudentsForYear,
  loadTeachers,
  saveMonthlyRecord,
} from "@/utils/storage";
import { START_YEAR, END_YEAR, TRACKING_MONTHS, formatYearKey, Student } from "@/types/student";
import {
  Submission,
  SubmissionStatus,
  PortalForm,
  loadSubmissions,
  updateSubmissionFields,
  setSubmissionStatus,
  deleteSubmission,
  formFromSubmission,
  formToRecord,
  emptyForm,
  saveManualSubmission,
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_COLORS,
  SUBMISSION_SOURCE_LABELS,
  SUBMISSION_SOURCE_COLORS,
} from "@/utils/teacherPortal";

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ar", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
};

const fieldLabel = (surah: number | null, ayah: number | null) =>
  surah ? `سورة ${surah}${ayah ? ` · آية ${ayah}` : ""}` : "—";

const SubmissionCard = ({
  sub,
  expanded,
  onToggle,
  onApprove,
  onReject,
  onReopen,
  onDelete,
  onChanged,
  busy,
}: {
  sub: Submission;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReopen: () => void;
  onDelete: () => void;
  onChanged: () => void;
  busy: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PortalForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing && !form) setForm(formFromSubmission(sub));
  }, [editing, form, sub]);

  const total =
    (Number(sub.memorization_hifz_score) || 0) +
    (Number(sub.memorization_recitation_score) || 0) +
    (Number(sub.review_hifz_score) || 0) +
    (Number(sub.review_recitation_score) || 0) +
    (Number(sub.attendance_score) || 0) +
    (Number(sub.behavior_score) || 0);

  const saveEdit = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await updateSubmissionFields(sub.user_id, sub, form);
      setEditing(false);
      setForm(null);
      onChanged();
    } catch (err) {
      console.error("تعذّر حفظ التعديل", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start transition-colors hover:bg-white/5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-bold text-white">{sub.student_name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${SUBMISSION_STATUS_COLORS[sub.status]}`}
            >
              {SUBMISSION_STATUS_LABELS[sub.status]}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${
                SUBMISSION_SOURCE_COLORS[sub.source ?? "portal"]
              }`}
            >
              {SUBMISSION_SOURCE_LABELS[sub.source ?? "portal"]}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/50">
              المجموع {total} / 100
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] text-white/40">
            {sub.portal_teacher_name || "—"} · آخر تحديث {fmtDate(sub.updated_at)}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-white/10 p-4">
          {editing && form ? (
            <>
              <PortalFormFields form={form} onChange={setForm} compact />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={saveEdit}
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  حفظ التعديل
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setForm(null);
                  }}
                  className="rounded-lg border-white/15 bg-transparent text-white/70 hover:bg-white/10"
                >
                  إلغاء
                </Button>
                <span className="text-[10px] text-white/40">
                  الحفظ يعيد الترسيل إلى «قيد المراجعة».
                </span>
              </div>
            </>
          ) : (
            <>
              {/* ملخص الحقول */}
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-xl bg-emerald-950/40 p-3 ring-1 ring-emerald-400/10">
                  <h4 className="mb-1.5 text-[11px] font-black text-emerald-300">الحفظ الجديد</h4>
                  <p className="text-white/70">
                    {fieldLabel(sub.memorization_from_surah, sub.memorization_from_ayah)} ←{" "}
                    {fieldLabel(sub.memorization_to_surah, sub.memorization_to_ayah)}
                  </p>
                  <p className="mt-1 text-white/50">
                    تسميع {sub.memorization_hifz_score} / 25 · تلاوة{" "}
                    {sub.memorization_recitation_score} / 15
                  </p>
                </div>
                <div className="rounded-xl bg-teal-950/40 p-3 ring-1 ring-teal-400/10">
                  <h4 className="mb-1.5 text-[11px] font-black text-teal-300">المراجعة</h4>
                  <p className="text-white/70">
                    {fieldLabel(sub.review_from_surah, sub.review_from_ayah)} ←{" "}
                    {fieldLabel(sub.review_to_surah, sub.review_to_ayah)}
                  </p>
                  <p className="mt-1 text-white/50">
                    تسميع {sub.review_hifz_score} / 25 · تلاوة {sub.review_recitation_score} / 15
                  </p>
                </div>
                <div className="rounded-xl bg-slate-900/60 p-3 ring-1 ring-white/10 sm:col-span-2">
                  <h4 className="mb-1.5 text-[11px] font-black text-white/70">المواظبة والسلوك</h4>
                  <p className="text-white/60">
                    المواظبة {sub.attendance_score} / 10 · السلوك {sub.behavior_score} / 10
                  </p>
                </div>
              </div>

              {(sub.notes || sub.review_note) && (
                <div className="space-y-1 rounded-xl bg-white/5 p-3 text-xs ring-1 ring-white/10">
                  {sub.notes && (
                    <p className="text-white/60">
                      <b className="text-white/80">ملاحظات المعلم/ة:</b> {sub.notes}
                    </p>
                  )}
                  {sub.review_note && (
                    <p className="text-rose-300">
                      <b>سبب الرفض:</b> {sub.review_note}
                    </p>
                  )}
                </div>
              )}

              {/* السجل */}
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-white/40">
                <div className="rounded-lg bg-white/5 p-2 ring-1 ring-white/10">
                  أُرسل في
                  <p className="mt-0.5 font-bold text-white/70">{fmtDate(sub.created_at)}</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2 ring-1 ring-white/10">
                  آخر تحديث
                  <p className="mt-0.5 font-bold text-white/70">{fmtDate(sub.updated_at)}</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2 ring-1 ring-white/10">
                  رُوجع في
                  <p className="mt-0.5 font-bold text-white/70">{fmtDate(sub.reviewed_at)}</p>
                </div>
              </div>

              {/* الإجراءات */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(true)}
                  className="rounded-lg border-white/15 bg-transparent text-white/70 hover:bg-white/10"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  تعديل
                </Button>
                {sub.status === "pending" ? (
                  <>
                    <Button
                      size="sm"
                      onClick={onApprove}
                      disabled={busy}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-500"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      اعتماد
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onReject}
                      disabled={busy}
                      className="rounded-lg border-rose-400/30 bg-transparent text-rose-300 hover:bg-rose-500/15"
                    >
                      <X className="h-3.5 w-3.5" />
                      رفض
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onReopen}
                    disabled={busy}
                    className="rounded-lg border-amber-400/30 bg-transparent text-amber-300 hover:bg-amber-500/15"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    إعادة للمراجعة
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDelete}
                  disabled={busy}
                  className="rounded-lg text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const Submissions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id || "";

  const [subs, setSubs] = useState<Submission[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState("");
  const [month, setMonth] = useState(0); // 0 = كل الشهور
  const [status, setStatus] = useState<SubmissionStatus | "all">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  // التقرير اليدوي (معلم/ة بلا جوال أو بلا إنترنت)
  const [teachers, setTeachers] = useState<string[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTeacher, setManualTeacher] = useState("");
  const [manualMonth, setManualMonth] = useState(1);
  const [manualStudent, setManualStudent] = useState("");
  const [manualForm, setManualForm] = useState<PortalForm>(emptyForm());
  const [savingManual, setSavingManual] = useState(false);

  // رفض: حوار ملاحظة
  const [rejectTarget, setRejectTarget] = useState<Submission | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  // حذف: تأكيد
  const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!year) return;
    setLoading(true);
    try {
      const [s, st, tc] = await Promise.all([
        loadSubmissions(userId, {
          year,
          month: month || undefined,
          status: status === "all" ? undefined : status,
        }),
        loadStudentsForYear(year),
        loadTeachers(year).catch(() => []),
      ]);
      setSubs(s);
      setStudents(st);
      setTeachers(
        Array.from(new Set(tc.map((t) => (t.name || "").trim()).filter(Boolean))).sort((a, b) =>
          a.localeCompare(b, "ar"),
        ),
      );
    } catch (err) {
      console.error(err);
      toast({
        title: "تعذّر التحميل",
        description: "تحقق من الاتصال وحاول مجدداً.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userId, year, month, status, toast]);

  useEffect(() => {
    void (async () => {
      const y = await getActiveYear();
      setYear(y);
    })();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const yearOptions = useMemo(() => {
    const list: string[] = [];
    for (let y = END_YEAR; y >= START_YEAR; y--) list.push(String(y));
    if (year && !list.includes(year)) list.unshift(year);
    return list;
  }, [year]);

  // إحصاءات الشهر (العام المختار + الشهر المختار إن حدد)
  const monthSubs = useMemo(
    () => subs.filter((s) => (month ? s.month === month : true)),
    [subs, month],
  );
  const pending = monthSubs.filter((s) => s.status === "pending").length;
  const approved = monthSubs.filter((s) => s.status === "approved").length;
  const rejected = monthSubs.filter((s) => s.status === "rejected").length;

  // طلاب العام الذين لم يرسلوا بعد (قيد المراجعة أو مٌعتمد) لهذا الشهر
  const notSubmitted = useMemo(() => {
    if (!month) return [];
    const submitted = new Set(
      subs.filter((s) => s.month === month && s.status !== "rejected").map((s) => s.student_id),
    );
    return students
      .filter((s) => !submitted.has(s.id))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
  }, [students, subs, month]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const approve = async (sub: Submission) => {
    setBusyId(sub.id);
    try {
      // 1) اكتب في المتابعة الشهرية (تحديث السنوية تلقائياً)
      const record = formToRecord(formFromSubmission(sub));
      const ok = await saveMonthlyRecord(sub.year, sub.student_id, sub.month, record);
      if (!ok) throw new Error("تعذّر الكتابة في المتابعة الشهرية");
      // 2) ثم غيّر الحالة
      await setSubmissionStatus(sub.user_id, sub.id, "approved");
      toast({
        title: "أُعتمد الترسيل",
        description: `حُفظت متابعة ${sub.student_name} في المتابعة الشهرية.`,
      });
      await load();
    } catch (err) {
      console.error(err);
      toast({
        title: "تعذّر الاعتماد",
        description: "تأكد من الاتصال بالإنترنت.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      await setSubmissionStatus(
        rejectTarget.user_id,
        rejectTarget.id,
        "rejected",
        rejectNote || undefined,
      );
      toast({
        title: "رُفض الترسيل",
        description: `سيُبلَّغ بالرفض في بوابة ${rejectTarget.student_name}.`,
      });
      setRejectTarget(null);
      setRejectNote("");
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: "تعذّر الرفض", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const reopen = async (sub: Submission) => {
    setBusyId(sub.id);
    try {
      await setSubmissionStatus(sub.user_id, sub.id, "pending");
      toast({ title: "عُدَّ للمراجعة" });
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: "تعذّر التنفيذ", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSubmission(deleteTarget.user_id, deleteTarget.id);
      toast({ title: "حُذف الترسيل" });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: "تعذّر الحذف", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  /** طلاب الحوار: طلاب المعلم/ة المختار إن وجدوا، وإلا كل طلاب العام. */
  const manualStudents = useMemo(() => {
    const list = manualTeacher
      ? students.filter((s) => (s.teacher || "").trim() === manualTeacher)
      : students;
    return [...(list.length ? list : students)].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", "ar"),
    );
  }, [students, manualTeacher]);

  /** حفظ التقرير اليدوي: للمراجعة، أو اعتماد مباشر في المتابعة الشهرية. */
  const saveManual = async (approve: boolean) => {
    if (!userId) return;
    const student = students.find((s) => String(s.id) === manualStudent);
    if (!manualTeacher.trim()) {
      toast({
        title: "اختر المعلم/ة",
        description: "الاسم مطلوب لحفظ التقرير اليدوي.",
        variant: "destructive",
      });
      return;
    }
    if (!student) {
      toast({ title: "اختر الطالب/ة", variant: "destructive" });
      return;
    }
    setSavingManual(true);
    try {
      await saveManualSubmission(userId, {
        teacher_name: manualTeacher,
        student_id: student.id,
        student_name: student.name,
        year,
        month: manualMonth,
        form: manualForm,
        status: approve ? "approved" : "pending",
      });
      if (approve) {
        const ok = await saveMonthlyRecord(year, student.id, manualMonth, formToRecord(manualForm));
        if (!ok) throw new Error("تعذّر الكتابة في المتابعة الشهرية");
      }
      toast({
        title: approve ? "حُفظ وأُعتمد" : "حُفظ للمراجعة",
        description: `${student.name} — ${monthLabelSafe(manualMonth)} ${formatYearKey(year)}`,
      });
      setManualOpen(false);
      setManualStudent("");
      setManualForm(emptyForm());
      await load();
    } catch (err) {
      console.error("تعذّر حفظ التقرير اليدوي", err);
      toast({
        title: "تعذّر الحفظ",
        description: "تحقق من الاتصال بالإنترنت وحاول مجدداً.",
        variant: "destructive",
      });
    } finally {
      setSavingManual(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* الترويسة */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-black text-white">
              <Inbox className="h-5 w-5 text-amber-300" />
              وارد المعلمين والمعلمات
              {pending > 0 && (
                <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-black text-amber-300 ring-1 ring-amber-400/40">
                  {pending} قيد المراجعة
                </span>
              )}
            </h1>
            <p className="mt-1 text-xs text-white/50">
              ترسيلات المعلمين والمعلمات من بواباتهم — راجعها واعتمدها لتُكتب في المتابعة الشهرية.
            </p>
          </div>
          <Button
            onClick={() => {
              setManualMonth(month || 1);
              setManualStudent("");
              setManualForm(emptyForm());
              setManualOpen(true);
            }}
            className="rounded-xl bg-violet-600 hover:bg-violet-500"
          >
            <FilePlus2 className="h-4 w-4" />
            تقرير يدوي
          </Button>
        </div>

        {/* المرشحات */}
        <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-white/50">العام</label>
            <Select value={year || undefined} onValueChange={setYear}>
              <SelectTrigger className="h-9 w-32 bg-white/5 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y}>
                    {formatYearKey(y)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-white/50">الشهر</label>
            <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
              <SelectTrigger className="h-9 w-36 bg-white/5 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">كل الشهور</SelectItem>
                {TRACKING_MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-white/50">الحالة</label>
            <Select value={status} onValueChange={(v) => setStatus(v as SubmissionStatus | "all")}>
              <SelectTrigger className="h-9 w-36 bg-white/5 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="pending">قيد المراجعة</SelectItem>
                <SelectItem value="approved">مٌعتمد</SelectItem>
                <SelectItem value="rejected">مرفوض</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          {/* قائمة الترسيلات */}
          <div className="min-w-0 flex-1 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 p-10 text-white/50 ring-1 ring-white/10">
                <Loader2 className="h-5 w-5 animate-spin" />
                جارٍ التحميل…
              </div>
            ) : subs.length === 0 ? (
              <div className="rounded-2xl bg-white/5 p-10 text-center ring-1 ring-white/10">
                <Inbox className="mx-auto h-8 w-8 text-white/20" />
                <p className="mt-2 text-sm font-bold text-white/50">لا توجد ترسيلات بهذا التصفية</p>
                <p className="mt-1 text-xs text-white/30">
                  أنشئ روابط للمعلمين والمعلمات من صفحة «روابط المعلمين والمعلمات» واطلب منهم إرسال
                  المتابعة.
                </p>
              </div>
            ) : (
              subs.map((sub) => (
                <SubmissionCard
                  key={sub.id}
                  sub={sub}
                  expanded={expanded.has(sub.id)}
                  onToggle={() => toggle(sub.id)}
                  onApprove={() => approve(sub)}
                  onReject={() => {
                    setRejectNote("");
                    setRejectTarget(sub);
                  }}
                  onReopen={() => reopen(sub)}
                  onDelete={() => setDeleteTarget(sub)}
                  onChanged={load}
                  busy={busyId === sub.id}
                />
              ))
            )}
          </div>

          {/* اللوحة الجانبية */}
          <aside className="w-full shrink-0 space-y-3 lg:w-72">
            <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-black text-white">
                <Users className="h-3.5 w-3.5 text-emerald-300" />
                {month > 0 ? monthLabelSafe(month) : "كل الشهور"} · {formatYearKey(year)}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                  <p className="text-lg font-black text-white">{students.length}</p>
                  <p className="text-[10px] font-bold text-white/40">طالب مسجّل</p>
                </div>
                <div className="rounded-xl bg-amber-400/10 p-3 ring-1 ring-amber-400/30">
                  <p className="text-lg font-black text-amber-300">{pending}</p>
                  <p className="text-[10px] font-bold text-amber-300/70">قيد المراجعة</p>
                </div>
                <div className="rounded-xl bg-emerald-400/10 p-3 ring-1 ring-emerald-400/30">
                  <p className="text-lg font-black text-emerald-300">{approved}</p>
                  <p className="text-[10px] font-bold text-emerald-300/70">مٌعتمد</p>
                </div>
                <div className="rounded-xl bg-rose-400/10 p-3 ring-1 ring-rose-400/30">
                  <p className="text-lg font-black text-rose-300">{rejected}</p>
                  <p className="text-[10px] font-bold text-rose-300/70">مرفوض</p>
                </div>
              </div>
            </div>

            {month > 0 && (
              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-black text-white">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-300" />
                  لم يرسلوا بعد ({notSubmitted.length})
                </h3>
                {notSubmitted.length === 0 ? (
                  <p className="text-xs text-emerald-300">أرسلوا كل طلاب الشهر 🎉</p>
                ) : (
                  <ul className="space-y-1">
                    {notSubmitted.slice(0, 12).map((s) => (
                      <li key={s.id} className="truncate text-xs text-white/60">
                        {s.name}
                      </li>
                    ))}
                    {notSubmitted.length > 12 && (
                      <li className="text-[10px] font-bold text-white/30">
                        +{notSubmitted.length - 12} آخرين
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* التقرير اليدوي — إدخال نيابة عن معلم/ة بلا رابط */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FilePlus2 className="h-4 w-4 text-violet-300" />
              تقرير يدوي — متابعة شهرية نيابة عن معلم/ة
            </DialogTitle>
            <p className="text-xs leading-relaxed text-white/50">
              لمن لا يملك جوالاً أو لا يستخدم الإنترنت: انقل بيانات ورقته هنا، ثم احفظها «للمراجعة»
              أو «اعتمدها» لتُكتب مباشرة في المتابعة الشهرية.
            </p>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-white/50">المعلم/ة</label>
                <Select
                  value={manualTeacher || undefined}
                  onValueChange={(v) => {
                    setManualTeacher(v);
                    setManualStudent("");
                  }}
                  disabled={teachers.length === 0}
                >
                  <SelectTrigger className="h-9 bg-white/5 text-sm">
                    <SelectValue
                      placeholder={
                        teachers.length === 0 ? "لا يوجد معلمون مضافون لهذا العام" : "اختر"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {teachers.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-white/50">الشهر</label>
                <Select
                  value={String(manualMonth)}
                  onValueChange={(v) => setManualMonth(parseInt(v))}
                >
                  <SelectTrigger className="h-9 bg-white/5 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRACKING_MONTHS.map((m) => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-white/50">العام</label>
                <div className="flex h-9 items-center rounded-md bg-white/5 px-3 text-sm font-bold text-white/70 ring-1 ring-white/10">
                  {year ? formatYearKey(year) : "—"}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-white/50">
                الطالب/ة ({manualStudents.length})
              </label>
              <Select value={manualStudent || undefined} onValueChange={setManualStudent}>
                <SelectTrigger className="h-9 bg-white/5 text-sm">
                  <SelectValue placeholder="اختر الطالب/ة" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {manualStudents.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                      {s.teacher ? ` — ${s.teacher}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {manualTeacher && manualStudents.length > 0 && (
                <p className="text-[10px] text-white/35">
                  تظهر قائمة طلاب هذا المعلم/ة في العام المختار.
                </p>
              )}
            </div>

            <PortalFormFields form={manualForm} onChange={setManualForm} compact />
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => setManualOpen(false)}
              className="rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
            >
              إلغاء
            </Button>
            <Button
              variant="outline"
              onClick={() => saveManual(false)}
              disabled={savingManual}
              className="rounded-lg border-white/15 bg-transparent text-white/80 hover:bg-white/10"
            >
              {savingManual ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              حفظ للمراجعة
            </Button>
            <Button
              onClick={() => saveManual(true)}
              disabled={savingManual}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500"
            >
              {savingManual ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BadgeCheck className="h-4 w-4" />
              )}
              حفظ واعتماد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار الرفض */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>رفض الترسيل</DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-3">
              <p className="text-xs text-white/50">
                متابعة <b className="text-white">{rejectTarget.student_name}</b> — سيُطلب من
                المعلم/ة إعادة الإرسال بعد معرفة السبب.
              </p>
              <Textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="سبب الرفض (اختياري)…"
                rows={3}
                className="bg-white/5 text-sm"
              />
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setRejectTarget(null)}
                  className="rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={confirmReject}
                  className="rounded-lg bg-rose-600 hover:bg-rose-500"
                >
                  <X className="h-4 w-4" />
                  رفض
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* تأكيد الحذف */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>حذف الترسيل؟</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-3">
              <p className="text-sm text-white/60">
                سيُحذف ترسيل <b className="text-white">{deleteTarget.student_name}</b> نهائياً (لا
                يمسّ بيانات المتابعة الشهرية المعتمدة).
              </p>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="rounded-lg bg-rose-600 hover:bg-rose-500"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  حذف
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const monthLabelSafe = (m: number) =>
  TRACKING_MONTHS.find((x) => x.value === m)?.label || String(m);

export default Submissions;
