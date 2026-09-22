/**
 * روابط المعلمين والمعلمات — إنشاء روابط خاصة (كود بدون حساب) لكل معلم/ة وعام/شهر،
 * ونسخها وتغيير الكود وإيقافها وحذفها، مع «نسخ روابط الكل».
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link2,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Pause,
  Play,
  Loader2,
  Inbox,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useAuth } from "@/hooks/useAuth";
import { getActiveYear, loadTeachers } from "@/utils/storage";
import { START_YEAR, END_YEAR, TRACKING_MONTHS, formatYearKey } from "@/types/student";
import {
  TeacherPortal,
  Submission,
  loadPortals,
  createPortal,
  updatePortal,
  deletePortal,
  getPortalLink,
  generatePortalCode,
  loadSubmissions,
} from "@/utils/teacherPortal";

const monthLabel = (m: number) => TRACKING_MONTHS.find((x) => x.value === m)?.label || String(m);

const TeacherLinks = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id || "";

  const [portals, setPortals] = useState<TeacherPortal[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  /** أسماء المعلمين والمعلمات المضافين في صفحة «المعلمين والمعلمات» لكل عام. */
  const [teachersByYear, setTeachersByYear] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  // نموذج الإنشاء
  const [activeYear, setActiveYear] = useState("");
  const [newTeacher, setNewTeacher] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newMonth, setNewMonth] = useState(1);
  const [creating, setCreating] = useState(false);

  // تغيير الكود
  const [codeDialog, setCodeDialog] = useState<TeacherPortal | null>(null);
  const [newCode, setNewCode] = useState("");
  const [savingCode, setSavingCode] = useState(false);

  // الحذف
  const [deleteTarget, setDeleteTarget] = useState<TeacherPortal | null>(null);
  const [deleting, setDeleting] = useState(false);

  // نسخ روابط الكل
  const [allLinksOpen, setAllLinksOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [p, s, t] = await Promise.all([
        loadPortals(userId),
        loadSubmissions(userId),
        // كل الأعوام: الروابط تُنشأ لعام قد يختلف عن العام النشط.
        loadTeachers().catch(() => []),
      ]);
      setPortals(p);
      setSubmissions(s);
      const byYear: Record<string, Set<string>> = {};
      for (const row of t) {
        const name = (row.name || "").trim();
        if (!name || !row.year) continue;
        (byYear[row.year] ??= new Set()).add(name);
      }
      setTeachersByYear(
        Object.fromEntries(
          Object.entries(byYear).map(([year, set]) => [
            year,
            Array.from(set).sort((a, b) => a.localeCompare(b, "ar")),
          ]),
        ),
      );
    } catch (err) {
      console.error("تعذّر تحميل روابط المعلمين والمعلمات", err);
      toast({
        title: "تعذّر التحميل",
        description: "تحقق من الاتصال وحاول مجدداً.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    void (async () => {
      const y = await getActiveYear();
      setActiveYear(y);
      setNewYear(y);
    })();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // عند تغيير العام: لا يُترك اسم غير مضاف في ذلك العام.
  useEffect(() => {
    if (newTeacher && !(teachersByYear[newYear] ?? []).includes(newTeacher)) setNewTeacher("");
  }, [newYear, teachersByYear, newTeacher]);

  /** أسماء المعلمين والمعلمات المضافين للعام المختار في نموذج الإنشاء. */
  const yearTeachers = useMemo(() => teachersByYear[newYear] ?? [], [teachersByYear, newYear]);

  /** هل الاسم مضاف فعلاً في صفحة المعلمين والمعلمات لهذا العام؟ */
  const isRegisteredTeacher = useCallback(
    (name: string, year: string) => (teachersByYear[year] ?? []).includes(name.trim()),
    [teachersByYear],
  );

  const yearOptions = useMemo(() => {
    const list: string[] = [];
    for (let y = END_YEAR; y >= START_YEAR; y--) list.push(String(y));
    if (activeYear && !list.includes(activeYear)) list.unshift(activeYear);
    return list;
  }, [activeYear]);

  const countsByPortal = useMemo(() => {
    const map: Record<string, { pending: number; approved: number; rejected: number }> = {};
    for (const s of submissions) {
      // الإدخال اليدوي ليس وراءه رابط، فلا يُحسب على أي رابط.
      if (!s.portal_id) continue;
      map[s.portal_id] ??= { pending: 0, approved: 0, rejected: 0 };
      if (s.status === "pending") map[s.portal_id].pending++;
      else if (s.status === "approved") map[s.portal_id].approved++;
      else map[s.portal_id].rejected++;
    }
    return map;
  }, [submissions]);

  const handleCreate = async () => {
    if (!userId) return;
    const name = newTeacher.trim();
    const year = newYear.trim();
    if (!name || !year) {
      toast({
        title: "أكمل الحقول",
        description: "اسم المعلم/ة والعام مطلوبان.",
        variant: "destructive",
      });
      return;
    }
    // لا يُرسل رابط إلا لمعلم/ة مضاف في صفحة «المعلمين والمعلمات» لهذا العام.
    if (!isRegisteredTeacher(name, year)) {
      toast({
        title: "غير مسموح",
        description: `«${name}» غير مضاف في صفحة المعلمين والمعلمات لعام ${formatYearKey(
          year,
        )}. أضفه هناك أولاً ثم أنشئ الرابط.`,
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    try {
      await createPortal(userId, { teacher_name: name, year, month: newMonth });
      setNewTeacher("");
      toast({ title: "أُنشئ الرابط", description: "انسخ الرابط وأرسله للمعلم/ة." });
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: "تعذّر إنشاء الرابط", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "نُسخ", description: label });
    } catch {
      toast({
        title: "تعذّر النسخ",
        description: "انسخ النص يدوياً من مربع الحوار.",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (portal: TeacherPortal) => {
    try {
      await updatePortal(userId, portal.id, { active: !portal.active });
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: "تعذّر التعديل", variant: "destructive" });
    }
  };

  const openCodeDialog = async (portal: TeacherPortal) => {
    setNewCode("");
    setCodeDialog(portal);
  };

  const handleSaveCode = async () => {
    if (!codeDialog) return;
    const code = newCode.trim();
    if (!code) {
      toast({ title: "الرمز فارغ", variant: "destructive" });
      return;
    }
    setSavingCode(true);
    try {
      await updatePortal(userId, codeDialog.id, { code });
      toast({ title: "تغيّر الكود", description: "استخدم الروابط الجديدة من اليوم." });
      setCodeDialog(null);
      await load();
    } catch (err) {
      console.error(err);
      toast({
        title: "تعذّر تغيير الكود",
        description: "قد يكون الرمز مستعملاً.",
        variant: "destructive",
      });
    } finally {
      setSavingCode(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePortal(userId, deleteTarget.id);
      toast({ title: "حُذف الرابط", description: "حُذفت ترسيلات هذا الرابط أيضاً." });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: "تعذّر الحذف", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const allLinksText = useMemo(() => {
    const byYear = new Map<string, TeacherPortal[]>();
    portals.forEach((p) => {
      byYear.set(p.year, [...(byYear.get(p.year) || []), p]);
    });
    return Array.from(byYear.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, list]) =>
        list
          .sort((a, b) => a.month - b.month || a.teacher_name.localeCompare(b.teacher_name, "ar"))
          .map((p) => {
            const c = countsByPortal[p.id];
            const mark = p.active ? "" : " [موقوف]";
            const sub = c ? ` (قيد المراجعة: ${c.pending})` : "";
            return `${p.teacher_name} · ${monthLabel(p.month)} ${formatYearKey(p.year)}${mark}${sub}\n${getPortalLink(p)}`;
          })
          .join("\n\n"),
      )
      .join("\n\n—————————————————\n\n");
  }, [portals, countsByPortal]);

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6" dir="rtl">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* الترويسة */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-black text-white">
              <Link2 className="h-5 w-5 text-violet-300" />
              روابط المعلمين والمعلمات
            </h1>
            <p className="mt-1 text-xs text-white/50">
              كل رابط يقود معلم/ة إلى بطاقات طلابه لعام وشهر محددين — بدون تسجيل دخول. يُنشأ الرابط
              فقط للمعلمين والمعلمات المضافين في صفحة «المعلمين والمعلمات».
            </p>
          </div>
          <Button
            onClick={() => setAllLinksOpen(true)}
            variant="outline"
            className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            <Copy className="h-4 w-4" />
            نسخ روابط الكل
          </Button>
        </div>

        {/* إنشاء رابط */}
        <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-white">
            <Plus className="h-4 w-4 text-emerald-300" />
            إنشاء رابط جديد
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-white/50">
                اسم المعلم/ة (من صفحة المعلمين والمعلمات)
              </label>
              <Select
                value={newTeacher || undefined}
                onValueChange={setNewTeacher}
                disabled={yearTeachers.length === 0}
              >
                <SelectTrigger className="h-9 bg-white/5 text-sm">
                  <SelectValue
                    placeholder={
                      yearTeachers.length === 0
                        ? "لا يوجد معلمون مضافون لهذا العام"
                        : "اختر المعلم/ة"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {yearTeachers.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {yearTeachers.length === 0 && (
                <p className="text-[10px] font-bold text-amber-300">
                  أضف المعلمين والمعلمات لعام {formatYearKey(newYear)} من صفحة «المعلمين والمعلمات
                  والإكراميات» أولاً.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-white/50">العام</label>
              <Select value={newYear || undefined} onValueChange={setNewYear}>
                <SelectTrigger className="h-9 bg-white/5 text-sm">
                  <SelectValue placeholder="اختر العام" />
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
              <Select value={String(newMonth)} onValueChange={(v) => setNewMonth(parseInt(v))}>
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
            <div className="flex items-end">
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                إنشاء
              </Button>
            </div>
          </div>
        </div>

        {/* قائمة الروابط */}
        <div className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="text-sm font-black text-white">روابطك ({portals.length})</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-white/50">
              <Loader2 className="h-5 w-5 animate-spin" />
              جارٍ التحميل…
            </div>
          ) : portals.length === 0 ? (
            <p className="p-8 text-center text-sm text-white/40">
              لا توجد روابط بعد — أنشئ أول رابط من الأعلى.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {portals.map((p) => {
                const c = countsByPortal[p.id];
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-bold text-white">
                          {p.teacher_name}
                        </span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/60">
                          {monthLabel(p.month)} · {formatYearKey(p.year)}
                        </span>
                        {p.active ? (
                          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-400/30">
                            نشط
                          </span>
                        ) : (
                          <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] font-bold text-rose-300 ring-1 ring-rose-400/30">
                            موقوف
                          </span>
                        )}
                        {c && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-400/30">
                            <Inbox className="h-3 w-3" />
                            {c.pending} قيد المراجعة
                          </span>
                        )}
                        {!isRegisteredTeacher(p.teacher_name, p.year) && (
                          <span
                            className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] font-bold text-rose-300 ring-1 ring-rose-400/30"
                            title="أضف هذا الاسم في صفحة المعلمين والمعلمات، أو احذف الرابط"
                          >
                            غير مضاف في صفحة المعلمين
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate font-mono text-[11px] text-white/40" dir="ltr">
                        {getPortalLink(p)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyText(getPortalLink(p), `رابط ${p.teacher_name}`)}
                        className="rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
                        aria-label="نسخ الرابط"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openCodeDialog(p)}
                        className="rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
                        aria-label="تغيير الكود"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleActive(p)}
                        className="rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
                        aria-label={p.active ? "إيقاف" : "تفعيل"}
                      >
                        {p.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(p)}
                        className="rounded-lg text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-white/40">
          · لا يُنشأ رابط إلا لمعلم/ة مضاف في صفحة «المعلمين والمعلمات والإكراميات» لنفس العام —
          الروابط التي اسمها غير مضاف تظهر بشارة تحذير حمراء. · «تغيير الكود» ينشئ رمزاً جديداً —
          الروابط القديمة تتوقف عن العمل، لذا أرسل الجديد للمعلم/ة. · «نسخ روابط الكل» يجمع روابط كل
          الأعوام بنص واحد جاهز للإرسال على واتساب. · إيقاف الرابط يبقي ترسيالاته السابقة محفوظة. ·
          من لا يملك جوالاً أو إنترنت: أدخل بياناته يدوياً من صفحة «وارد المعلمين والمعلمات».
        </p>
      </div>

      {/* حوار تغيير الكود */}
      <Dialog open={!!codeDialog} onOpenChange={(o) => !o && setCodeDialog(null)}>
        <DialogContent className="bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>تغيير كود الرابط</DialogTitle>
          </DialogHeader>
          {codeDialog && (
            <div className="space-y-3">
              <p className="text-xs text-white/50">
                {codeDialog.teacher_name} · {monthLabel(codeDialog.month)}{" "}
                {formatYearKey(codeDialog.year)}
                {" — "}الرمز الحالي:{" "}
                <span className="font-mono" dir="ltr">
                  {codeDialog.code}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="رمز جديد (8 أحرف على الأقل)"
                  className="bg-white/5 text-sm"
                  dir="ltr"
                />
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      setNewCode(
                        await generatePortalCode(userId, codeDialog.year, codeDialog.month),
                      );
                    } catch {
                      toast({ title: "تعذّر توليد رمز", variant: "destructive" });
                    }
                  }}
                  className="shrink-0 rounded-lg border-white/15 bg-transparent text-white/70 hover:bg-white/10"
                >
                  توليد
                </Button>
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setCodeDialog(null)}
                  className="rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleSaveCode}
                  disabled={savingCode}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500"
                >
                  {savingCode ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  حفظ
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* حوار الحذف */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>حذف الرابط؟</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-3">
              <p className="text-sm text-white/60">
                سيُحذف رابط{" "}
                <b className="text-white">
                  {deleteTarget.teacher_name} · {monthLabel(deleteTarget.month)}{" "}
                  {formatYearKey(deleteTarget.year)}
                </b>{" "}
                <b>مع كل ترسيلاته</b> (سجل المتابعة التي أرسلها هذا المعلم/ة عبر هذا الرابط).
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
                  onClick={handleDelete}
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

      {/* حوار نسخ روابط الكل */}
      <Dialog open={allLinksOpen} onOpenChange={setAllLinksOpen}>
        <DialogContent className="max-w-lg bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>روابط المعلمين والمعلمات</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              readOnly
              value={allLinksText || "لا توجد روابط بعد."}
              rows={12}
              className="w-full rounded-xl bg-white/5 p-3 font-mono text-[11px] text-white/80 ring-1 ring-white/10"
              dir="ltr"
            />
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setAllLinksOpen(false)}
                className="rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
              >
                إغلاق
              </Button>
              <Button
                onClick={() => copyText(allLinksText, "روابط المعلمين والمعلمات كاملة")}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500"
              >
                <Copy className="h-4 w-4" />
                نسخ الكل
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherLinks;
