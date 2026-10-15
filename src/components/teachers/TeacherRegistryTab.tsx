import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarDays,
  Eye,
  GraduationCap,
  Package,
  Pencil,
  Plus,
  ScrollText,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import {
  clearTeacherFromStudents,
  deleteTeacherByName,
  renameTeacher,
  saveTeacher,
} from "@/utils/storage";
import { arabicIncludes } from "@/utils/arabicSearch";
import {
  amount,
  annualTotalFor,
  formatAmount,
  isTeacherRecipient,
  monthlyTotalFor,
  studentsByTeacher,
  type TeacherTabProps,
} from "./shared";

/**
 * التبويب الأول: السجل العام للمعلمين والمعلمات — إضافة/تعديل/حذف الأسماء
 * بلا أي ارتباط بعام، مع ملخص ما يخصّ كل معلم/ة في بقية التبويبات.
 */
export function TeacherRegistryTab({
  teachers,
  students,
  bonuses,
  awards,
  certificates,
  readOnly,
  onChanged,
}: TeacherTabProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [viewTarget, setViewTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [detachStudents, setDetachStudents] = useState(true);
  const [busy, setBusy] = useState(false);

  const studentsMap = useMemo(() => studentsByTeacher(students), [students]);

  const rows = useMemo(() => {
    const names = new Set(teachers.map((teacher) => teacher.name.trim()).filter(Boolean));
    // أسماء ظهرت في الإكراميات أو الجوائز أو الشهادات ولم تُضف للسجل العام.
    bonuses.forEach((bonus) => names.add((bonus.teacher_name || "").trim()));
    awards
      .filter((award) => isTeacherRecipient(award.recipient_type))
      .forEach((award) => names.add((award.recipient_name || "").trim()));
    certificates
      .filter((certificate) => isTeacherRecipient(certificate.recipient_type))
      .forEach((certificate) => names.add((certificate.recipient_name || "").trim()));

    return Array.from(names)
      .filter(Boolean)
      .map((name) => {
        const registered = teachers.some((teacher) => teacher.name === name);
        const teacherStudents = studentsMap.get(name) || [];
        const years = new Set<string>();
        teacherStudents.forEach((student) =>
          (student.registered_years || []).forEach((year) => years.add(year.replace(/D$/, ""))),
        );
        const certificatesCount = certificates.filter(
          (certificate) =>
            certificate.recipient_name === name && isTeacherRecipient(certificate.recipient_type),
        ).length;
        const inKindCount = awards.filter(
          (award) =>
            award.recipient_name === name &&
            isTeacherRecipient(award.recipient_type) &&
            award.award_kind === "in_kind",
        ).length;
        return {
          name,
          registered,
          students: teacherStudents,
          years: Array.from(years).sort(),
          monthly: monthlyTotalFor(bonuses, name),
          annual: annualTotalFor(awards, name),
          certificatesCount,
          inKindCount,
        };
      })
      .filter((row) => !query.trim() || arabicIncludes(row.name, query))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [awards, bonuses, certificates, query, studentsMap, teachers]);

  const totalStudentsLinked = useMemo(
    () => rows.reduce((sum, row) => sum + row.students.length, 0),
    [rows],
  );

  const handleAdd = useCallback(async () => {
    const name = newName.trim();
    if (!name) {
      toast({ title: "اسم المعلم/ة مطلوب", variant: "destructive" });
      return;
    }
    if (teachers.some((teacher) => teacher.name === name)) {
      toast({ title: "الاسم موجود في السجل", description: `${name} مضاف مسبقاً.` });
      return;
    }
    setSaving(true);
    try {
      await saveTeacher({ name });
      toast({
        title: "تمت الإضافة إلى السجل العام",
        description: `${name} — يظهر الآن في كل الأعوام والتبويبات.`,
      });
      setNewName("");
      setAddOpen(false);
      await onChanged();
    } catch (error) {
      console.error(error);
      toast({ title: "تعذرت الإضافة", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [newName, onChanged, teachers, toast]);

  const handleRename = useCallback(async () => {
    if (!editTarget) return;
    const next = editName.trim();
    if (!next || next === editTarget) {
      setEditTarget(null);
      return;
    }
    // السجل العام لا يقبل تكرار الأسماء: إن وُجد الاسم الجديد فسيُدمج السجلان.
    if (teachers.some((teacher) => teacher.name === next)) {
      if (
        !confirm(
          `«${next}» موجود في السجل العام.\nسَيُدمج المعلم/ان في سجل واحد (الطلاب والإكراميات والشهادات والمساعدات معاً).\nهل تريد المتابعة؟`,
        )
      ) {
        return;
      }
    }
    setBusy(true);
    try {
      const affected = await renameTeacher(editTarget, next);
      toast({
        title: "تم تعديل الاسم",
        description: `تم تحديث الاسم في السجل و${affected} طالب/ة والإكراميات والشهادات المرتبطة.`,
      });
      setEditTarget(null);
      await onChanged();
    } catch (error) {
      console.error(error);
      toast({ title: "تعذر التعديل", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [editName, editTarget, onChanged, teachers, toast]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const linked = studentsMap.get(deleteTarget)?.length || 0;
      await deleteTeacherByName(deleteTarget);
      if (detachStudents && linked > 0) {
        await clearTeacherFromStudents(deleteTarget);
      }
      toast({
        title: "تم الحذف من السجل العام",
        description: detachStudents
          ? `تمت إزالة الاسم من ${linked} طالب/ة ومن الحلقات.`
          : "بقيت أسماء الطلاب كما هي بدون معلم/ة مضاف في السجل.",
        variant: "destructive",
      });
      setDeleteTarget(null);
      await onChanged();
    } catch (error) {
      console.error(error);
      toast({ title: "تعذر الحذف", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [deleteTarget, detachStudents, onChanged, studentsMap, toast]);

  const viewStudents = viewTarget ? studentsMap.get(viewTarget) || [] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-card/85 p-3 shadow-md backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث باسم المعلم/ة"
              className="w-56 rounded-xl pr-9"
            />
          </div>
          <Badge variant="secondary" className="rounded-full">
            {teachers.length} في السجل العام
          </Badge>
          <Badge variant="secondary" className="rounded-full">
            {totalStudentsLinked} ارتباط بطالب
          </Badge>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          disabled={readOnly}
          className="h-9 gap-1.5 rounded-xl text-xs"
        >
          <Plus className="h-4 w-4" /> إضافة معلم/ة
        </Button>
      </div>

      {readOnly && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-100/80 p-3 text-sm text-amber-900">
          وضع الاطلاع للقراءة فقط: لا يمكن إضافة أو تعديل أو حذف أسماء المعلمين والمعلمات.
        </div>
      )}

      <div className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-card/90 shadow-xl shadow-primary/5">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            لا يوجد معلمون ومعلمات في السجل العام بعد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary text-primary-foreground">
                <tr>
                  <th className="px-3 py-3 text-right">#</th>
                  <th className="px-3 py-3 text-right">اسم المعلم/ة</th>
                  <th className="px-3 py-3 text-center">الحالة</th>
                  <th className="px-3 py-3 text-center">عدد الطلاب</th>
                  <th className="px-3 py-3 text-center">أعوام الحلقات</th>
                  <th className="px-3 py-3 text-center">إكراميات شهرية</th>
                  <th className="px-3 py-3 text-center">إكراميات سنوية</th>
                  <th className="px-3 py-3 text-center">شهادات</th>
                  <th className="px-3 py-3 text-center">مساعدات عينية</th>
                  <th className="px-3 py-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.name} className="border-t border-border hover:bg-muted/40">
                    <td className="px-3 py-3 text-right font-bold">{index + 1}</td>
                    <td className="px-3 py-3 text-right font-semibold">{row.name}</td>
                    <td className="px-3 py-3 text-center">
                      {row.registered ? (
                        <span className="font-semibold text-emerald-600">في السجل</span>
                      ) : (
                        <span className="font-semibold text-amber-600">من بيانات أخرى</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center font-bold">{row.students.length}</td>
                    <td className="px-3 py-3 text-center text-xs text-muted-foreground">
                      {row.years.length ? row.years.join(" · ") : "—"}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-emerald-700">
                      {formatAmount(row.monthly)}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-amber-700">
                      {formatAmount(row.annual)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Badge variant="outline" className="gap-1">
                        <ScrollText className="h-3 w-3" /> {row.certificatesCount}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Badge variant="outline" className="gap-1">
                        <Package className="h-3 w-3" /> {row.inKindCount}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap justify-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-xs"
                          onClick={() => setViewTarget(row.name)}
                        >
                          <Eye className="h-3.5 w-3.5" /> الطلاب
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 gap-1 text-xs"
                          disabled={readOnly}
                          onClick={() => {
                            setEditTarget(row.name);
                            setEditName(row.name);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> تعديل
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 gap-1 text-xs"
                          disabled={readOnly}
                          onClick={() => {
                            setDetachStudents(true);
                            setDeleteTarget(row.name);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> حذف
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/60 font-bold">
                <tr>
                  <td className="px-3 py-3" colSpan={5}>
                    الإجمالي ({rows.length} معلم/ة)
                  </td>
                  <td className="px-3 py-3 text-center text-emerald-700">
                    {formatAmount(rows.reduce((sum, row) => sum + row.monthly, 0))}
                  </td>
                  <td className="px-3 py-3 text-center text-amber-700">
                    {formatAmount(rows.reduce((sum, row) => sum + row.annual, 0))}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {rows.reduce((sum, row) => sum + row.certificatesCount, 0)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {rows.reduce((sum, row) => sum + row.inKindCount, 0)}
                  </td>
                  <td className="px-3 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        هذا السجل <span className="font-bold">عام ومستقل تماماً عن الأعوام</span>: أضف الاسم مرة
        واحدة وستجده في كل الأعوام والتبويبات. ربط الطلاب بالمعلمين والمعلمات نفسه يتم في صفحة
        «الحلقات» لكل عام على حدة.
      </p>

      {/* إضافة */}
      <Dialog open={addOpen} onOpenChange={(open) => !saving && setAddOpen(open)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> إضافة معلم/ة إلى السجل العام
            </DialogTitle>
            <DialogDescription>
              السجل غير مرتبط بأي عام — الاسم يُضاف مرة واحدة ويظهر في كل الأعوام.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <label className="text-sm font-bold">اسم المعلم/ة</label>
            <Input
              autoFocus
              value={newName}
              disabled={saving}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleAdd();
              }}
              placeholder="مثال: عبدالله أحمد"
              className="rounded-xl"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={() => void handleAdd()} disabled={saving || !newName.trim()}>
              {saving ? "جارٍ الإضافة..." : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تعديل الاسم */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل اسم المعلم/ة</DialogTitle>
            <DialogDescription>
              سيُحدَّث الاسم في السجل العام وفي سجلات الطلاب والحلقات والإكراميات والشهادات
              والمساعدات المرتبطة به.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <label className="text-sm font-bold">الاسم الجديد</label>
            <Input
              autoFocus
              value={editName}
              disabled={busy}
              onChange={(event) => setEditName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleRename();
              }}
              className="rounded-xl"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={busy}>
              إلغاء
            </Button>
            <Button onClick={() => void handleRename()} disabled={busy || !editName.trim()}>
              {busy ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حذف */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-destructive">حذف من السجل العام</DialogTitle>
            <DialogDescription>
              حذف «{deleteTarget}» من سجل المعلمين والمعلمات (سجل عام لكل الأعوام).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1 text-sm">
            <p>
              عدد الطلاب المرتبطين حالياً:{" "}
              <span className="font-bold">
                {(deleteTarget ? studentsMap.get(deleteTarget)?.length : 0) || 0}
              </span>
            </p>
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border bg-muted/40 p-3">
              <Checkbox
                checked={detachStudents}
                onCheckedChange={(checked) => setDetachStudents(checked === true)}
                className="mt-0.5"
              />
              <span>
                إزالة اسمه/اسمها من خانة «المعلم/ة» ومن ربط الحلقات في كل الأعوام.
                <span className="mt-1 block text-xs text-muted-foreground">
                  إن أزلت العلامة، سيبقى الاسم ظاهراً في السجل بشارة «من بيانات أخرى» لأن الطلاب ما
                  زالوا مرتبطين به.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={busy}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={busy}>
              {busy ? "جارٍ الحذف..." : "تأكيد الحذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* طلاب المعلم/ة */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" /> طلاب: {viewTarget}
            </DialogTitle>
            <DialogDescription>
              الطلاب المرتبطون بهذا الاسم في السجل الشامل (كل الأعوام) — {viewStudents.length}{" "}
              طالب/ة
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-2xl border">
            {viewStudents.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                لا يوجد طلاب مرتبطون بهذا الاسم حالياً.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-2 py-2 text-right">#</th>
                    <th className="px-2 py-2 text-right">الاسم</th>
                    <th className="px-2 py-2 text-center">الجنس</th>
                    <th className="px-2 py-2 text-center">أعوام التسجيل</th>
                    <th className="px-2 py-2 text-center">
                      <CalendarDays className="mx-auto h-3.5 w-3.5" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {viewStudents.map((student, index) => (
                    <tr key={student.id} className="border-t border-border">
                      <td className="px-2 py-2 text-right">{index + 1}</td>
                      <td className="px-2 py-2 text-right font-medium">{student.name || "—"}</td>
                      <td className="px-2 py-2 text-center">{student.gender || "—"}</td>
                      <td className="px-2 py-2 text-center text-xs text-muted-foreground">
                        {(student.registered_years || []).join(" · ") || "—"}
                      </td>
                      <td className="px-2 py-2 text-center text-xs">
                        {amount(student.latest_total_hifz) > 0 ? student.latest_total_hifz : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
