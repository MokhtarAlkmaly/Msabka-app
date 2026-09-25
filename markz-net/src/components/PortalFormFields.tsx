/**
 * حقول المتابعة الشهرية المشتركة — تُستعمل في بوابة المعلم/ة (الصفحة العامة)
 * وفي صفحة «وارد المعلمين والمعلمات» (تعديل الترسيل): من/إلى للحفظ الجديد والمراجعة،
 * التسميع والتلاوة، المواظبة والسلوك، والملاحظات.
 */

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SURAH_LIST } from "@/utils/quranData";
import { PortalForm } from "@/utils/teacherPortal";

interface PointSelectProps {
  label: string;
  surah: string;
  ayah: string;
  onChange: (surah: string, ayah: string) => void;
  compact?: boolean;
}

/** اختيار نقطة (سورة + آية) مقيّد بعدد آيات السورة. */
export const PointSelect = ({
  label,
  surah,
  ayah,
  onChange,
  compact = false,
}: PointSelectProps) => {
  const surahOption = SURAH_LIST.find((s) => String(s.number) === surah);
  const maxAyah = surahOption?.ayahCount ?? 0;
  return (
    <div className="space-y-1">
      <span className="text-[11px] font-bold text-white/50">{label}</span>
      <div className="flex items-center gap-1.5">
        <Select value={surah || undefined} onValueChange={(v) => onChange(v, "")}>
          <SelectTrigger className={`flex-1 bg-white/5 text-sm ${compact ? "h-8" : "h-9"}`}>
            <SelectValue placeholder="السورة" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {SURAH_LIST.map((s) => (
              <SelectItem key={s.number} value={String(s.number)}>
                {s.number} · {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={1}
          max={maxAyah || undefined}
          value={ayah}
          onChange={(e) => onChange(surah, e.target.value)}
          placeholder="آية"
          className={`w-16 bg-white/5 text-sm ${compact ? "h-8" : "h-9"}`}
        />
      </div>
    </div>
  );
};

interface PortalFormFieldsProps {
  form: PortalForm;
  onChange: (form: PortalForm) => void;
  compact?: boolean;
  showNotes?: boolean;
}

/** كامل حقول المتابعة الشهرية (نفس أقسام شاشة المتابعة الشهرية). */
export const PortalFormFields = ({
  form,
  onChange,
  compact = false,
  showNotes = true,
}: PortalFormFieldsProps) => {
  const set = (patch: Partial<PortalForm>) => onChange({ ...form, ...patch });
  const height = compact ? "h-8" : "h-9";

  return (
    <div className="space-y-3">
      {/* الحفظ الجديد */}
      <div className="rounded-xl bg-emerald-950/40 p-3 ring-1 ring-emerald-400/10">
        <h4 className="mb-2 text-xs font-black text-emerald-300">الحفظ الجديد</h4>
        <div className={`grid grid-cols-2 gap-2 ${compact ? "" : ""}`}>
          <PointSelect
            label="من"
            surah={form.memoFromSurah}
            ayah={form.memoFromAyah}
            onChange={(s, a) => set({ memoFromSurah: s, memoFromAyah: a })}
            compact={compact}
          />
          <PointSelect
            label="إلى"
            surah={form.memoToSurah}
            ayah={form.memoToAyah}
            onChange={(s, a) => set({ memoToSurah: s, memoToAyah: a })}
            compact={compact}
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-white/50">تسميع الحفظ (25)</span>
            <Input
              type="number"
              min={0}
              max={25}
              value={form.memoHifz}
              onChange={(e) => set({ memoHifz: e.target.value })}
              placeholder="0"
              className={`bg-white/5 text-sm ${height}`}
            />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-white/50">تلاوة الحفظ (15)</span>
            <Input
              type="number"
              min={0}
              max={15}
              value={form.memoRecite}
              onChange={(e) => set({ memoRecite: e.target.value })}
              placeholder="0"
              className={`bg-white/5 text-sm ${height}`}
            />
          </div>
        </div>
      </div>

      {/* المراجعة */}
      <div className="rounded-xl bg-teal-950/40 p-3 ring-1 ring-teal-400/10">
        <h4 className="mb-2 text-xs font-black text-teal-300">المراجعة</h4>
        <div className="grid grid-cols-2 gap-2">
          <PointSelect
            label="من"
            surah={form.reviewFromSurah}
            ayah={form.reviewFromAyah}
            onChange={(s, a) => set({ reviewFromSurah: s, reviewFromAyah: a })}
            compact={compact}
          />
          <PointSelect
            label="إلى"
            surah={form.reviewToSurah}
            ayah={form.reviewToAyah}
            onChange={(s, a) => set({ reviewToSurah: s, reviewToAyah: a })}
            compact={compact}
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-white/50">تسميع المراجعة (25)</span>
            <Input
              type="number"
              min={0}
              max={25}
              value={form.reviewHifz}
              onChange={(e) => set({ reviewHifz: e.target.value })}
              placeholder="0"
              className={`bg-white/5 text-sm ${height}`}
            />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-white/50">تلاوة المراجعة (15)</span>
            <Input
              type="number"
              min={0}
              max={15}
              value={form.reviewRecite}
              onChange={(e) => set({ reviewRecite: e.target.value })}
              placeholder="0"
              className={`bg-white/5 text-sm ${height}`}
            />
          </div>
        </div>
      </div>

      {/* المواظبة والسلوك */}
      <div className="rounded-xl bg-slate-900/60 p-3 ring-1 ring-white/10">
        <h4 className="mb-2 text-xs font-black text-white/70">المواظبة والسلوك</h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-white/50">المواظبة (10)</span>
            <Input
              type="number"
              min={0}
              max={10}
              value={form.attendance}
              onChange={(e) => set({ attendance: e.target.value })}
              placeholder="0"
              className={`bg-white/5 text-sm ${height}`}
            />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-white/50">السلوك (10)</span>
            <Input
              type="number"
              min={0}
              max={10}
              value={form.behavior}
              onChange={(e) => set({ behavior: e.target.value })}
              placeholder="0"
              className={`bg-white/5 text-sm ${height}`}
            />
          </div>
        </div>
      </div>

      {showNotes && (
        <Textarea
          value={form.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="ملاحظات (اختياري)…"
          rows={2}
          className="bg-white/5 text-sm"
        />
      )}
    </div>
  );
};
