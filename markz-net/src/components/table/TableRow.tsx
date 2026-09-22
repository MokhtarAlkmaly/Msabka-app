import { Student } from "@/types/student";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { StudentReport } from "@/components/StudentReport";
import { useState, useEffect, useCallback } from "react";
import { resolveBaseHifz, calculateGrade, calculatePrize } from "@/utils/calculations";
import { HifzHistory, YearData } from "@/types/student";

interface Props {
  student: Student;
  index: number;
  currentYear: string;
  onDelete: (id: number) => void;
  onDirtyChange: (
    studentId: number,
    data: { name: string; teacher: string; history: HifzHistory; yearData: YearData },
  ) => void;
  teacherNames?: string[];
  /** عدد مرات تكرار الاسم في السجل — يُمرَّر من الجدول الأب لتمييز الأسماء المكررة */
  duplicateNameCount?: number;
}

export const TableRow = ({
  student,
  index,
  currentYear,
  onDelete,
  onDirtyChange,
  teacherNames = [],
  duplicateNameCount = 0,
}: Props) => {
  const currentYearNum = parseInt(currentYear);
  const [name, setName] = useState(student.name);
  const [history, setHistory] = useState<HifzHistory>(student.hifzHistory || {});
  const [yearData, setYearData] = useState<YearData>(
    student.yearData || {
      baseHifz: "0",
      totalHifz: "0",
      parts: "",
      annual: "",
      recitation: "",
      memorization: "",
      total: "0",
      grade: "",
      prize: "0",
      statusPrize: "",
      rank: "-",
      teacher: "",
    },
  );

  useEffect(() => {
    setName(student.name);
    setHistory(student.hifzHistory || {});
    setYearData(
      student.yearData || {
        baseHifz: "0",
        totalHifz: "0",
        parts: "",
        annual: "",
        recitation: "",
        memorization: "",
        total: "0",
        grade: "",
        prize: "0",
        statusPrize: "",
        rank: "-",
        teacher: "",
      },
    );
  }, [student]);

  const baseHifz = resolveBaseHifz(history, currentYearNum, yearData.baseHifz);
  const parts = parseFloat(yearData.parts) || 0;
  const totalHifz = Math.min(baseHifz + parts, 30);
  const annual = parseFloat(yearData.annual) || 0;
  const recitation = parseFloat(yearData.recitation) || 0;
  const memorization = parseFloat(yearData.memorization) || 0;
  const totalScore = Math.min(annual + recitation + memorization, 100);
  const { grade, pricePerPart } = calculateGrade(totalScore);
  const prize = calculatePrize(parts, pricePerPart);
  const isActive = parts > 0 || totalScore > 0;
  const isKhatim = totalHifz >= 30;

  const notifyDirty = useCallback(
    (newName: string, newHistory: HifzHistory, newYearData: YearData) => {
      const p = parseFloat(newYearData.parts) || 0;
      const a = parseFloat(newYearData.annual) || 0;
      const r = parseFloat(newYearData.recitation) || 0;
      const m = parseFloat(newYearData.memorization) || 0;
      const ts = Math.min(a + r + m, 100);
      const bh = resolveBaseHifz(newHistory, currentYearNum, newYearData.baseHifz);
      const th = Math.min(bh + p, 30);
      const { grade: g, pricePerPart: pp } = calculateGrade(ts);
      const pr = calculatePrize(p, pp);

      const updatedYearData: YearData = {
        ...newYearData,
        baseHifz: bh.toString(),
        totalHifz: th.toString(),
        total: ts.toString(),
        grade: g,
        prize: pr.toString(),
      };

      onDirtyChange(student.id, {
        name: newName,
        teacher: newYearData.teacher,
        history: newHistory,
        yearData: updatedYearData,
      });
    },
    [student.id, currentYearNum, onDirtyChange],
  );

  const updateName = (value: string) => {
    setName(value);
    notifyDirty(value, history, yearData);
  };

  const updateTeacher = (value: string) => {
    const updated = { ...yearData, teacher: value };
    setYearData(updated);
    notifyDirty(name, history, updated);
  };

  const updateYearField = (field: keyof YearData, value: string) => {
    const updated = { ...yearData, [field]: value };
    setYearData(updated);
    notifyDirty(name, history, updated);
  };

  const isDuplicateName = duplicateNameCount > 1;

  return (
    <tr className="group transition-colors odd:bg-white even:bg-secondary/20 hover:bg-primary/5">
      <td className="sticky right-0 z-10 w-[50px] min-w-[50px] border-b border-l border-border/70 bg-card p-1 text-center font-black text-primary shadow-[-10px_0_18px_-18px_rgba(0,0,0,.35)] group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950">
        {index}
      </td>

      <td
        className={`sticky right-[50px] z-10 w-[280px] min-w-[280px] border-b border-l border-border/70 p-1 transition-colors shadow-[-10px_0_18px_-18px_rgba(0,0,0,.35)] ${
          isDuplicateName
            ? "bg-amber-100 group-hover:bg-amber-200 dark:bg-amber-800 dark:group-hover:bg-amber-700"
            : "bg-card group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950"
        }`}
      >
        <Input
          value={name}
          onChange={(e) => updateName(e.target.value)}
          placeholder="الاسم"
          title={
            isDuplicateName
              ? `⚠️ اسم مكرر: يوجد ${duplicateNameCount} طلاب بنفس الاسم في السجل`
              : undefined
          }
          className={`h-10 rounded-xl border-0 text-center font-semibold focus-visible:ring-1 ${
            isDuplicateName
              ? "bg-amber-50 text-amber-900 ring-2 ring-amber-400 dark:bg-amber-900 dark:text-amber-100"
              : "bg-background/70"
          }`}
        />
      </td>

      <td className="border-b border-l border-border/70 p-1">
        <Select
          value={yearData.teacher || "__none__"}
          onValueChange={(v) => updateTeacher(v === "__none__" ? "" : v)}
        >
          <SelectTrigger className="h-10 w-full min-w-[120px] rounded-xl border-0 bg-background/70 text-center focus:ring-1">
            <SelectValue placeholder="المعلم/ة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— بدون —</SelectItem>
            {yearData.teacher && !teacherNames.includes(yearData.teacher) && (
              <SelectItem value={yearData.teacher}>{yearData.teacher} (غير مسجل)</SelectItem>
            )}
            {teacherNames.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      <td className="border-b border-l border-border/70 bg-accent/20 p-1 text-center font-bold">
        {baseHifz > 0 ? baseHifz : "-"}
      </td>

      <td className="border-b border-l border-border/70 bg-warning/10 p-1">
        <Input
          type="number"
          value={yearData.parts}
          onChange={(e) => updateYearField("parts", e.target.value)}
          placeholder="0"
          min="0"
          className="h-10 w-20 rounded-xl border-0 bg-background/70 text-center font-semibold focus-visible:ring-1"
        />
      </td>

      <td
        className={`border-b border-l border-border/70 p-1 ${isKhatim ? "bg-islamic-gold/20" : "bg-islamic-green/10"}`}
      >
        {isKhatim ? (
          <span className="text-center font-bold text-islamic-gold block">خاتم ✨</span>
        ) : (
          <Input
            value={totalHifz}
            readOnly
            className="h-10 rounded-xl border-0 bg-transparent text-center font-bold text-islamic-green"
          />
        )}
      </td>

      <td className="border-b border-l border-border/70 bg-success/5 p-1">
        <Input
          type="number"
          value={yearData.annual}
          onChange={(e) => updateYearField("annual", e.target.value)}
          placeholder="0"
          min="0"
          max="20"
          className="h-10 w-16 rounded-xl border-0 bg-background/70 text-center focus-visible:ring-1"
        />
      </td>

      <td className="border-b border-l border-border/70 bg-success/5 p-1">
        <Input
          type="number"
          value={yearData.recitation}
          onChange={(e) => updateYearField("recitation", e.target.value)}
          placeholder="0"
          min="0"
          max="20"
          className="h-10 w-16 rounded-xl border-0 bg-background/70 text-center focus-visible:ring-1"
        />
      </td>

      <td className="border-b border-l border-border/70 bg-success/5 p-1">
        <Input
          type="number"
          value={yearData.memorization}
          onChange={(e) => updateYearField("memorization", e.target.value)}
          placeholder="0"
          min="0"
          max="60"
          className="h-10 w-16 rounded-xl border-0 bg-background/70 text-center focus-visible:ring-1"
        />
      </td>

      <td className="border-b border-l border-border/70 bg-success/10 p-1">
        <Input
          value={totalScore}
          readOnly
          className="h-10 rounded-xl border-0 bg-transparent text-center font-bold"
        />
      </td>

      <td className="border-b border-l border-border/70 p-1 text-center font-semibold">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs ${isActive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}
        >
          {isActive ? "نشط" : "منقطع"}
        </span>
      </td>

      <td className="border-b border-l border-border/70 p-1 text-center font-bold">{grade}</td>

      <td className="border-b border-l border-border/70 p-1 text-center font-bold text-islamic-green">
        {prize.toLocaleString()}
      </td>

      <td className="border-b border-l border-border/70 p-1">
        <Input
          type="number"
          value={yearData.statusPrize || ""}
          onChange={(e) => updateYearField("statusPrize", e.target.value)}
          placeholder="0"
          min="0"
          className="h-10 w-20 rounded-xl border-0 bg-background/70 text-center font-semibold focus-visible:ring-1"
        />
      </td>

      <td className="border-b border-l border-border/70 p-1 text-center font-black text-primary">
        {yearData.rank}
      </td>

      <td className="border-b border-l border-border/70 p-1 text-center">
        <StudentReport student={student} />
      </td>

      <td className="border-b border-l border-border/70 p-1 text-center">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(student.id)}
          className="h-9 w-9 rounded-xl p-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
};
