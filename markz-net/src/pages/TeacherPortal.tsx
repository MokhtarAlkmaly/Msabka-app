/**
 * بوابة المعلم/ة — صفحة عامة (بدون تسجيل دخول).
 *
 * تفتح المعلم/ة رابطها الخاص: /teacher?t=<code>&y=<year>&m=<month>
 * ترى بطاقات طلابه لهذا العام/الشهر فقط، وتدخل حقول المتابعة الشهرية
 * كاملة (نفس شاشة المتابعة الشهرية): من/إلى للحفظ الجديد والمراجعة،
 * التسميع والتلاوة، المواظبة والسلوك — مع زر «ابدأ من نهاية الشهر
 * السابق»، وحفظ مسودة على الجوال قبل الإرسال.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Send,
  Save,
  History,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Loader2,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalFormFields } from "@/components/PortalFormFields";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "@/lib/router-compat";
import { calcPagesBetweenAsync } from "@/utils/quranData";
import { formatYearKey } from "@/types/student";
import { TRACKING_MONTHS } from "@/types/student";
import logo from "@/assets/logo.png";
import {
  PortalView,
  PortalForm,
  PortalStudent,
  emptyForm,
  formToRecord,
  formFromSubmission,
  openPortalByCode,
  submitTeacherMonthly,
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_COLORS,
} from "@/utils/teacherPortal";

const draftKey = (code: string, studentId: number) => `teacher-portal-draft:${code}:${studentId}`;

const readDraft = (key: string): PortalForm | null => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortalForm;
    return { ...emptyForm(), ...parsed };
  } catch {
    return null;
  }
};

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const StudentCard = ({
  student,
  code,
  year,
  month,
  expanded,
  onToggle,
  form,
  setForm,
  onSend,
  onDraft,
  sending,
  sentAt,
  sendError,
  memoPages,
}: {
  student: PortalStudent;
  code: string;
  year: string;
  month: number;
  expanded: boolean;
  onToggle: () => void;
  form: PortalForm;
  setForm: (f: PortalForm) => void;
  onSend: () => void;
  onDraft: () => void;
  sending: boolean;
  sentAt: string | null;
  sendError: string | null;
  memoPages: number;
}) => {
  const statusBadge = sentAt
    ? "مُرسَل"
    : student.existing
      ? SUBMISSION_STATUS_LABELS[student.existing.status]
      : "لم يُرسل";

  const badgeClass = sentAt
    ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30"
    : student.existing
      ? SUBMISSION_STATUS_COLORS[student.existing.status]
      : "bg-white/10 text-white/60 ring-white/15";

  return (
    <div className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start transition-colors hover:bg-white/5"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-bold text-white">{student.student_name}</span>
          {memoPages > 0 && expanded && (
            <span className="shrink-0 rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-bold text-sky-300 ring-1 ring-sky-400/30">
              {memoPages} وجه
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${badgeClass}`}>
            {statusBadge}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-white/40 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-white/10 p-4">
          <PortalFormFields form={form} onChange={setForm} />

          {sendError && (
            <p className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 ring-1 ring-rose-400/30">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {sendError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg border-white/15 bg-transparent text-white/70 hover:bg-white/10"
              onClick={onDraft}
            >
              <Save className="h-3.5 w-3.5" />
              حفظ مسودة
            </Button>
            <Button
              size="sm"
              onClick={onSend}
              disabled={sending}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {student.existing || sentAt ? "تحديث الإرسال" : "إرسال"}
            </Button>
            {sentAt && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                تم الإرسال
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const TeacherPortal = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const code = (searchParams.get("t") || "").trim();
  const urlYear = searchParams.get("y") || "";
  const urlMonth = parseInt(searchParams.get("m") || "1", 10) || 1;

  const [portal, setPortal] = useState<PortalView | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [forms, setForms] = useState<Record<number, PortalForm>>({});
  const [sending, setSending] = useState<Record<number, boolean>>({});
  const [sentAt, setSentAt] = useState<Record<number, string | null>>({});
  const [sendErrors, setSendErrors] = useState<Record<number, string | null>>({});
  const [memoPages, setMemoPages] = useState<Record<number, number>>({});

  // تحميل البوابة
  useEffect(() => {
    if (!code) {
      setLoadState("error");
      setLoadError("لا يوجد رمز في الرابط. راجع المشرف/ة.");
      return;
    }
    let cancelled = false;
    (async () => {
      const { portal: view, error } = await openPortalByCode(code);
      if (cancelled) return;
      if (error || !view) {
        setLoadState("error");
        setLoadError(error || "تعذّر فتح البوابة.");
        return;
      }
      setPortal(view);
      setLoadState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // تعبئة تلقائية من نهاية الشهر السابق عند فتح البطاقة
  useEffect(() => {
    if (!portal) return;
    portal.students.forEach((student) => {
      if (forms[student.student_id]) return;
      const source = student.existing ? formFromSubmission(student.existing) : null;
      const draft = readDraft(draftKey(portal.code, student.student_id));
      const base = source ?? draft ?? emptyForm();
      if (!base.memoFromSurah && !base.reviewFromSurah) {
        if (student.prevMemo.surah) {
          base.memoFromSurah = String(student.prevMemo.surah);
          base.memoFromAyah = student.prevMemo.ayah ? String(student.prevMemo.ayah) : "";
        }
        if (student.prevReview.surah) {
          base.reviewFromSurah = String(student.prevReview.surah);
          base.reviewFromAyah = student.prevReview.ayah ? String(student.prevReview.ayah) : "";
        }
      }
      setForms((prev) => ({ ...prev, [student.student_id]: base }));
      if (student.existing) {
        setSentAt((prev) => ({
          ...prev,
          [student.student_id]: prev[student.student_id] ?? student.existing!.updated_at,
        }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal]);

  // حساب عدد الأوجه تلقائياً
  useEffect(() => {
    portal?.students.forEach((student) => {
      const f = forms[student.student_id];
      if (!f) return;
      if (f.memoFromSurah && f.memoToSurah && f.memoFromAyah && f.memoToAyah) {
        calcPagesBetweenAsync(
          parseInt(f.memoFromSurah),
          parseInt(f.memoFromAyah),
          parseInt(f.memoToSurah),
          parseInt(f.memoToAyah),
        ).then((pages) => setMemoPages((prev) => ({ ...prev, [student.student_id]: pages })));
      } else {
        setMemoPages((prev) => ({ ...prev, [student.student_id]: 0 }));
      }
    });
  }, [forms, portal]);

  const toggle = (studentId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const saveDraft = (student: PortalStudent) => {
    const f = forms[student.student_id];
    if (!f) return;
    window.localStorage.setItem(draftKey(portal!.code, student.student_id), JSON.stringify(f));
    toast({
      title: "حُفظت المسودة",
      description: "ستجدها هنا عند إعادة فتح الصفحة على هذا الجوال.",
    });
  };

  const send = async (student: PortalStudent) => {
    if (!portal) return;
    const f = forms[student.student_id];
    if (!f) return;
    const record = formToRecord(f);
    setSending((prev) => ({ ...prev, [student.student_id]: true }));
    setSendErrors((prev) => ({ ...prev, [student.student_id]: null }));
    const result = await submitTeacherMonthly({
      code: portal.code,
      student_id: student.student_id,
      student_name: student.student_name,
      year: portal.year,
      month: portal.month,
      memorization_from_surah: record.memoFrom.surah,
      memorization_from_ayah: record.memoFrom.ayah,
      memorization_to_surah: record.memoTo.surah,
      memorization_to_ayah: record.memoTo.ayah,
      memorization_hifz_score: num(f.memoHifz),
      memorization_recitation_score: num(f.memoRecite),
      review_from_surah: record.reviewFrom.surah,
      review_from_ayah: record.reviewFrom.ayah,
      review_to_surah: record.reviewTo.surah,
      review_to_ayah: record.reviewTo.ayah,
      review_hifz_score: num(f.reviewHifz),
      review_recitation_score: num(f.reviewRecite),
      attendance_score: num(f.attendance),
      behavior_score: num(f.behavior),
      notes: f.notes || null,
    });
    setSending((prev) => ({ ...prev, [student.student_id]: false }));
    if (!result.ok) {
      setSendErrors((prev) => ({ ...prev, [student.student_id]: result.error }));
      return;
    }
    window.localStorage.removeItem(draftKey(portal.code, student.student_id));
    setSentAt((prev) => ({ ...prev, [student.student_id]: new Date().toISOString() }));
    toast({
      title: "تم الإرسال",
      description: `أُرسلت متابعة ${student.student_name} إلى المشرف/ة.`,
    });
  };

  const monthLabel = useMemo(
    () => TRACKING_MONTHS.find((m) => m.value === (portal?.month ?? urlMonth))?.label || "",
    [portal, urlMonth],
  );
  const yearLabel = formatYearKey(portal?.year || urlYear || "");

  if (loadState === "loading") {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-950"
        dir="rtl"
      >
        <div className="flex flex-col items-center gap-3 text-white/60">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <p className="text-sm font-bold">جارٍ فتح البوابة…</p>
        </div>
      </div>
    );
  }

  if (loadState === "error" || !portal) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-950 p-4"
        dir="rtl"
      >
        <div className="w-full max-w-sm rounded-3xl bg-white/5 p-6 text-center ring-1 ring-white/10">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-400" />
          <h1 className="mt-3 text-lg font-black text-white">تعذّر فتح البوابة</h1>
          <p className="mt-2 text-sm text-white/60">{loadError}</p>
          <a
            href="/"
            className="mt-4 inline-block text-xs font-bold text-emerald-300 underline underline-offset-4"
          >
            العودة للرئيسية
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-950 pb-10"
      dir="rtl"
    >
      {/* الترويسة */}
      <header className="border-b border-white/10 bg-emerald-950/60 px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="rounded-2xl bg-white/95 p-1.5 shadow-lg ring-2 ring-amber-400/30">
            <img
              src={logo}
              alt="Markz Net — نسخة بلا إنترنت"
              className="h-11 w-11 object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
              <Link2 className="h-3 w-3" />
              بوابة المعلم/ة · Markz Net — نسخة بلا إنترنت
            </p>
            <h1 className="truncate text-lg font-black text-white">
              متابعة {monthLabel} · {yearLabel}
            </h1>
            <p className="truncate text-xs text-white/50">
              للمعلم/ة: {portal.teacher_name} · {portal.students.length} طالب/ة
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-3 pt-4">
        <p className="rounded-xl bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-white/50 ring-1 ring-white/10">
          اختر طالب/ة ثم أدخل حقول الشهر كاملة. يمكنك «حفظ مسودة» قبل الإرسال، وإرسالها عند جاهزيتك
          — وإذا أعدت الإرسال لنفس الطالب/ة يُحدَّث الإرسال القديم تلقائياً.
        </p>

        {portal.students.map((student) => (
          <StudentCard
            key={student.student_id}
            student={student}
            code={portal.code}
            year={portal.year}
            month={portal.month}
            expanded={expanded.has(student.student_id)}
            onToggle={() => toggle(student.student_id)}
            form={forms[student.student_id] ?? emptyForm()}
            setForm={(f) => setForms((prev) => ({ ...prev, [student.student_id]: f }))}
            onSend={() => send(student)}
            onDraft={() => saveDraft(student)}
            sending={!!sending[student.student_id]}
            sentAt={sentAt[student.student_id] ?? null}
            sendError={sendErrors[student.student_id] ?? null}
            memoPages={memoPages[student.student_id] ?? 0}
          />
        ))}

        <p className="pt-2 text-center text-[10px] text-white/30">
          Markz Net — نسخة بلا إنترنت · قسم القرآن الكريم
        </p>
      </main>
    </div>
  );
};

export default TeacherPortal;
