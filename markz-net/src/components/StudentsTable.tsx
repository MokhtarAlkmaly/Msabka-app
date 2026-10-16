import { useState, useMemo } from "react";
import {
  Student,
  CustomColumnDef,
  DEFAULT_STATUSES,
  GENDER_OPTIONS,
  formatYearKey,
  formatYearKeyShort,
} from "@/types/student";
import { Input } from "@/components/ui/input";
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
import {
  Trash2,
  MessageCircle,
  Plus,
  Search,
  Printer,
  FileSpreadsheet,
  Columns,
  GraduationCap,
  ExternalLink,
  AlertTriangle,
  X,
  PencilLine,
  ListFilter,
} from "lucide-react";
import { StudentProfileModal } from "./StudentProfileModal";
import { getDuplicateNameCounts, getDuplicateCountFor } from "@/utils/studentNames";
import {
  ALL_GRADES_VALUE,
  buildSchoolGradeOptions,
  matchesSchoolGrade,
} from "@/utils/schoolGrades";
import { esc } from "@/utils/report";
import { loadXLSX, saveWorkbook } from "@/utils/excel";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { BRAND_PRINT_TITLE } from "@/lib/brand";

/* ==========================================================================
 * تنسيق أعمدة الجدول
 * كل عرض/تنسيق يُعرَّف مرة واحدة هنا ويُستخدم في الرأس (<colgroup> + <th>)
 * وفي الخلايا، حتى تبقى الأعمدة متساوية ومحاذاتها موحّدة تمامًا.
 * ========================================================================== */

/** عامل التحويل من rem إلى بكسل — يُستخدم لحساب أقل عرض مسموح للجدول */
const REM_PX = 16;

/**
 * أعمدة الجدول: الترتيب والعنوان والعرض والمحاذاة.
 * العرض يُطبَّق على <col> في <colgroup> فيتطابق الرأس مع الخلايا تمامًا.
 */
const TABLE_COLUMNS: { key: string; label: string; width: string; align: "center" | "right" }[] = [
  { key: "index", label: "م", width: "3rem", align: "center" },
  { key: "name", label: "اسم الطالب", width: "19rem", align: "right" },
  { key: "gender", label: "الجنس", width: "5.5rem", align: "center" },
  { key: "teacher", label: "المعلم/ة", width: "9rem", align: "center" },
  { key: "hijri_join_date", label: "تاريخ هجري الالتحاق", width: "8.5rem", align: "center" },
  { key: "initial_hifz", label: "الحفظ قبل الالتحاق", width: "8.5rem", align: "center" },
  { key: "latest_total_hifz", label: "الحفظ التراكمي (آخر عام)", width: "8.5rem", align: "center" },
  { key: "first_competition_year", label: "عام المسابقة الأولى", width: "8rem", align: "center" },
  { key: "registered_years", label: "الأعوام المسجل بها", width: "11rem", align: "center" },
  { key: "status", label: "الحالة", width: "8rem", align: "center" },
  {
    key: "school_grade",
    label: "السنة الدراسية وقت الالتحاق",
    width: "10rem",
    align: "center",
  },
  { key: "guardian_phone", label: "رقم ولي الأمر", width: "9rem", align: "center" },
  { key: "student_phone", label: "رقم الطالب", width: "8.5rem", align: "center" },
];

/** عرض أعمدة: المخصّصة، والإجراءات */
const CUSTOM_COLUMN_WIDTH = "9rem";
const ACTIONS_COLUMN_WIDTH = "6.5rem";

/** القيم الخاصة داخل القوائم المنسدلة للخلايا */
const NONE_VALUE = "__none__";
const MANUAL_GRADE_VALUE = "__manual__";

/** ارتفاعات وتنسيقات موحّدة لكل خلايا الجدول */
const HEAD_CELL =
  "sticky top-0 z-30 h-12 whitespace-normal align-middle bg-emerald-900 px-2 py-2 text-[11px] leading-snug border-b border-l border-emerald-800/70";
const HEAD_CELL_INDEX = cn(HEAD_CELL, "right-0 z-40");
const HEAD_CELL_NAME = cn(HEAD_CELL, "right-12 z-40 shadow-[-8px_0_12px_-10px_rgba(0,0,0,0.45)]");
const HEAD_CELL_CUSTOM = cn(HEAD_CELL, "bg-teal-900");
const BODY_CELL = "border-b border-l border-border/70 p-1.5 align-middle";
const BODY_CELL_STICKY = cn(BODY_CELL, "sticky right-0 z-10 bg-card text-center");
const CELL_INPUT = "h-9 w-full rounded-xl border-0 bg-background/70 px-2 text-center text-xs";
const CELL_INPUT_NUMERIC = cn(CELL_INPUT, "tabular-nums font-bold");
const CELL_SELECT =
  "h-9 w-full rounded-xl border-0 bg-background/70 px-2 text-center text-xs font-bold";

interface Props {
  students: Student[];
  onUpdate: () => void;
  onSaveStudent: (student: Partial<Student> & { id?: number; name: string }) => Promise<unknown>;
  onDeleteStudent: (id: number) => Promise<unknown>;
  teacherNames: string[];
  customColumns: CustomColumnDef[];
  onAddCustomColumn: (col: CustomColumnDef) => Promise<unknown>;
  onDeleteCustomColumn: (colId: string) => Promise<unknown>;
  studentStatuses: string[];
  onAddStatus: (status: string) => Promise<unknown>;
  dirtyMap: Record<number, Student>;
  onDirtyChange: (studentId: number, data: Student) => void;
  activeYear?: string;
}

export const StudentsTable = ({
  students,
  onUpdate,
  onSaveStudent,
  onDeleteStudent,
  teacherNames,
  customColumns,
  onAddCustomColumn,
  onDeleteCustomColumn,
  studentStatuses = DEFAULT_STATUSES,
  onAddStatus,
  dirtyMap,
  onDirtyChange,
  activeYear = "1447",
}: Props) => {
  const { toast } = useToast();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedGrade, setSelectedGrade] = useState<string>(ALL_GRADES_VALUE);
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  /** الطلاب الذين اختاروا الكتابة اليدوية للسنة الدراسية داخل الجدول */
  const [manualGradeIds, setManualGradeIds] = useState<number[]>([]);

  // Active student for profile modal
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Dialogs
  const [newColumnDialogOpen, setNewColumnDialogOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState<CustomColumnDef["type"]>("text");

  const [newStatusDialogOpen, setNewStatusDialogOpen] = useState(false);
  const [newStatusName, setNewStatusName] = useState("");
  const [statusTargetStudentId, setStatusTargetStudentId] = useState<number | null>(null);

  const [manageColsOpen, setManageColsOpen] = useState(false);

  // Local student update helper
  const updateStudentField = (
    student: Student,
    field: keyof Student,
    value: Student[keyof Student],
  ) => {
    const current = dirtyMap[student.id] || student;
    const updated = { ...current, [field]: value } as Student;
    onDirtyChange(student.id, updated);
  };

  const updateStudentCustomField = (student: Student, columnId: string, value: string) => {
    const current = dirtyMap[student.id] || student;
    const customFields = { ...(current.custom_fields || {}), [columnId]: value };
    const updated = { ...current, custom_fields: customFields };
    onDirtyChange(student.id, updated);
  };

  const handleOpenProfile = (student: Student) => {
    const current = dirtyMap[student.id] || student;
    setSelectedStudent(current);
    setProfileModalOpen(true);
  };

  // Status creation
  const handleCreateStatus = async () => {
    const trimmed = newStatusName.trim();
    if (!trimmed) return;
    await onAddStatus(trimmed);
    if (statusTargetStudentId) {
      const s = students.find((st) => st.id === statusTargetStudentId);
      if (s) {
        updateStudentField(s, "status", trimmed);
      }
    }
    setNewStatusName("");
    setStatusTargetStudentId(null);
    setNewStatusDialogOpen(false);
    toast({ title: "تمت إضافة الحالة الجديدة", description: `أُضيفت "${trimmed}" لقائمة الحالات` });
  };

  // Column creation
  const handleCreateColumn = async () => {
    const trimmed = newColumnName.trim();
    if (!trimmed) {
      toast({ title: "اسم العمود مطلوب", variant: "destructive" });
      return;
    }
    const newId = `col_${Date.now()}`;
    await onAddCustomColumn({
      id: newId,
      name: trimmed,
      type: newColumnType,
    });
    setNewColumnName("");
    setNewColumnDialogOpen(false);
    toast({ title: "تمت إضافة العمود الجديد", description: `أُضيف عمود "${trimmed}" للجدول` });
  };

  // السنوات الدراسية: قائمة المركز الثابتة + أي قيم مكتوبة داخل السجل، بترتيب
  // تربوي ومع عدد الطلاب في كل سنة — هذه هي القائمة التي تغذّي الفلتر المنسدل
  // وخلايا العمود معًا، فتعمل التصفية دائمًا مهما اختلفت صياغة النص.
  const gradeOptions = useMemo(
    () =>
      buildSchoolGradeOptions(students, [selectedGrade === ALL_GRADES_VALUE ? "" : selectedGrade]),
    [students, selectedGrade],
  );
  const gradeLabels = useMemo(() => gradeOptions.map((option) => option.value), [gradeOptions]);
  const studentsWithoutGradeCount = useMemo(
    () => students.filter((s) => !(s.school_grade || "").trim()).length,
    [students],
  );
  const selectedGradeLabel = useMemo(() => {
    if (selectedGrade === ALL_GRADES_VALUE) return "كل السنوات الدراسية";
    return gradeOptions.find((option) => option.value === selectedGrade)?.label || selectedGrade;
  }, [selectedGrade, gradeOptions]);

  // Duplicate names across the whole registry (normalized, Arabic-aware)
  const duplicateNameCounts = useMemo(() => getDuplicateNameCounts(students), [students]);
  const duplicateGroupsCount = duplicateNameCounts.size;
  const duplicateStudentsCount = useMemo(
    () =>
      students.reduce(
        (acc, s) => acc + (getDuplicateCountFor(s.name, duplicateNameCounts) > 1 ? 1 : 0),
        0,
      ),
    [students, duplicateNameCounts],
  );

  /**
   * أقل عرض مسموح للجدول = مجموع عروض كل الأعمدة (بالبكسل)، فتبقى الأعمدة
   * بأحجامها المتساوية ولا تنضغط على الشاشات الضيقة، ويظهر شريط تمرير أفقي.
   */
  const tableMinWidth = useMemo(() => {
    const fixedWidth = TABLE_COLUMNS.reduce((total, column) => total + parseFloat(column.width), 0);
    const customWidth = customColumns.length * parseFloat(CUSTOM_COLUMN_WIDTH);
    return Math.round((fixedWidth + customWidth + parseFloat(ACTIONS_COLUMN_WIDTH)) * REM_PX);
  }, [customColumns.length]);

  // Filtered Students list
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const current = dirtyMap[s.id] || s;
      if (selectedTeacher !== "all" && (current.teacher || "") !== selectedTeacher) return false;
      if (duplicatesOnly && getDuplicateCountFor(current.name, duplicateNameCounts) < 2) {
        return false;
      }
      if (selectedStatus !== "all" && (current.status || "طبيعي") !== selectedStatus) return false;
      if (
        selectedGrade !== ALL_GRADES_VALUE &&
        !matchesSchoolGrade(current.school_grade, selectedGrade)
      )
        return false;
      if (selectedGender !== "all" && (current.gender || "") !== selectedGender) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = (current.name || "").toLowerCase().includes(q);
        const matchesGuardianPhone = (current.guardian_phone || "").includes(q);
        const matchesStudentPhone = (current.student_phone || "").includes(q);
        const matchesTeacher = (current.teacher || "").toLowerCase().includes(q);
        const matchesStatus = (current.status || "").toLowerCase().includes(q);
        const matchesGrade = (current.school_grade || "").toLowerCase().includes(q);
        const matchesGender = (current.gender || "").toLowerCase().includes(q);
        if (
          !matchesName &&
          !matchesGuardianPhone &&
          !matchesStudentPhone &&
          !matchesTeacher &&
          !matchesStatus &&
          !matchesGrade &&
          !matchesGender
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    students,
    dirtyMap,
    selectedTeacher,
    selectedStatus,
    selectedGrade,
    selectedGender,
    searchQuery,
    duplicatesOnly,
    duplicateNameCounts,
  ]);

  // حالة الفلاتر: تُعرض كرقائق (chips) أسفل شريط التصفية مع زرّ مسح سريع،
  // حتى يعرف المستخدم دائمًا أن قائمة "كل السنوات الدراسية" مُفعَّلة فعلًا.
  const hasActiveFilters =
    !!searchQuery.trim() ||
    selectedTeacher !== "all" ||
    selectedStatus !== "all" ||
    selectedGrade !== ALL_GRADES_VALUE ||
    selectedGender !== "all" ||
    duplicatesOnly;

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (searchQuery.trim())
      chips.push({
        key: "search",
        label: `البحث: ${searchQuery.trim()}`,
        onClear: () => setSearchQuery(""),
      });
    if (selectedTeacher !== "all")
      chips.push({
        key: "teacher",
        label: `المعلم/ة: ${selectedTeacher}`,
        onClear: () => setSelectedTeacher("all"),
      });
    if (selectedStatus !== "all")
      chips.push({
        key: "status",
        label: `الحالة: ${selectedStatus}`,
        onClear: () => setSelectedStatus("all"),
      });
    if (selectedGrade !== ALL_GRADES_VALUE)
      chips.push({
        key: "grade",
        label: `السنة الدراسية: ${selectedGradeLabel}`,
        onClear: () => setSelectedGrade(ALL_GRADES_VALUE),
      });
    if (selectedGender !== "all")
      chips.push({
        key: "gender",
        label: `الجنس: ${selectedGender}`,
        onClear: () => setSelectedGender("all"),
      });
    if (duplicatesOnly)
      chips.push({
        key: "duplicates",
        label: "الأسماء المكررة فقط",
        onClear: () => setDuplicatesOnly(false),
      });
    return chips;
  }, [
    searchQuery,
    selectedTeacher,
    selectedStatus,
    selectedGrade,
    selectedGender,
    duplicatesOnly,
    selectedGradeLabel,
  ]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedTeacher("all");
    setSelectedStatus("all");
    setSelectedGrade(ALL_GRADES_VALUE);
    setSelectedGender("all");
    setDuplicatesOnly(false);
  };

  // Export to Excel
  const handleExportExcel = async () => {
    const data = filteredStudents.map((s, i) => {
      const current = dirtyMap[s.id] || s;
      const row: Record<string, string | number> = {
        م: i + 1,
        "رقم القيد": current.id,
        "اسم الطالب": current.name,
        الجنس: current.gender || "",
        "المعلم/ة": current.teacher || "",
        "تاريخ هجري الالتحاق": current.hijri_join_date || "",
        "الحفظ قبل الالتحاق": current.initial_hifz || "0",
        "الحفظ التراكمي (آخر عام)": current.latest_total_hifz || "0",
        "عام أول مسابقة": current.first_competition_year || "",
        "الأعوام المسجل بها": (current.registered_years || [])
          .map((y) => formatYearKey(y))
          .join("، "),
        الحالة: current.status || "طبيعي",
        "السنة الدراسية وقت الالتحاق": current.school_grade || "",
        "رقم ولي الأمر": current.guardian_phone || "",
        "رقم الطالب": current.student_phone || "",
      };

      customColumns.forEach((col) => {
        row[col.name] = current.custom_fields?.[col.id] || "";
      });

      return row;
    });

    const XLSX = await loadXLSX();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "سجل الطلاب الشامل");

    const fileName = `سجل_الطلاب_الشامل_كل_الأعوام_مركز_إنماء.xlsx`;
    await saveWorkbook(wb, fileName);
    toast({
      title: "تم التصدير",
      description: `تم تصدير ${filteredStudents.length} طالب من السجل الشامل (كل الأعوام) إلى ملف Excel بنجاح`,
    });
  };

  // Print Official Table
  const handlePrint = async () => {
    const { printHtmlDocument } = await import("@/utils/nativePrint");

    const rowsHtml = filteredStudents
      .map((s, i) => {
        const current = dirtyMap[s.id] || s;
        const customCells = customColumns
          .map((col) => `<td>${esc(current.custom_fields?.[col.id] || "—")}</td>`)
          .join("");

        const yearsLabel =
          (current.registered_years || []).length > 0
            ? (current.registered_years || []).map((y) => esc(formatYearKey(y))).join("، ")
            : "—";

        return `<tr>
          <td>${i + 1}</td>
          <td class="name font-bold">${esc(current.name)}</td>
          <td>${esc(current.gender || "—")}</td>
          <td>${esc(current.teacher || "—")}</td>
          <td>${esc(current.hijri_join_date || "—")}</td>
          <td>${esc(current.initial_hifz || "0")} جزء</td>
          <td>${esc(current.latest_total_hifz || "0")} جزء</td>
          <td>${esc(current.first_competition_year || "—")}</td>
          <td>${yearsLabel}</td>
          <td>${esc(current.status || "طبيعي")}</td>
          <td>${esc(current.school_grade || "—")}</td>
          <td dir="ltr">${esc(current.guardian_phone || "—")}</td>
          <td dir="ltr">${esc(current.student_phone || "—")}</td>
          ${customCells}
        </tr>`;
      })
      .join("");

    const customHeaders = customColumns.map((col) => `<th>${esc(col.name)}</th>`).join("");

    const fullHtml = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>سجل الطلاب الرسمي | Markz Net — نسخة بلا إنترنت</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px; color: #1a3a2a; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 3px double #0e6b3a; padding-bottom: 12px; }
        .header img { height: 75px; margin-bottom: 6px; }
        .header h1 { font-size: 20px; color: #0e6b3a; font-weight: bold; }
        .header h2 { font-size: 15px; color: #444; margin-top: 3px; }
        .sub { font-size: 12px; color: #666; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
        th { background: #0e6b3a; color: white; padding: 6px 4px; border: 1px solid #084826; text-align: center; }
        td { padding: 5px 4px; border: 1px solid #ccc; text-align: center; }
        tr:nth-child(even) { background: #f9fdfb; }
        .name { text-align: right; padding-right: 8px; font-weight: 600; color: #000; }
        .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 8px; }
        @media print { body { padding: 10px; } @page { size: landscape; margin: 8mm; } }
      </style></head><body>
        <div class="header">
          <img src="${logo}" alt="الشعار" />
          <h1>${BRAND_PRINT_TITLE}</h1>
          <h2>كشف السجل الشامل لطلاب المركز — كل الأعوام</h2>
          <div class="sub">إجمالي الطلاب في السجل الشامل: <strong>${filteredStudents.length}</strong> طالب</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>م</th><th>اسم الطالب</th><th>الجنس</th><th>المعلم/ة</th><th>تاريخ هجري الالتحاق</th>
              <th>الحفظ قبل الالتحاق</th><th>الحفظ التراكمي</th><th>عام أول مسابقة</th><th>الأعوام المسجل بها</th>
              <th>الحالة</th><th>السنة الدراسية</th>
              <th>رقم ولي الأمر</th><th>رقم الطالب</th>
              ${customHeaders}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="footer">
          تصميم أ/ مختار الكمالي — طُبع بتاريخ: ${new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
        </div>
      </body></html>`;

    printHtmlDocument(fullHtml, `سجل_الطلاب_الشامل_كل_الأعوام_مركز_إنماء`);
  };

  return (
    <div className="space-y-4">
      {/* Controls & Search Toolbar */}
      <div className="rounded-[1.75rem] border border-white/70 bg-card/90 p-4 shadow-xl shadow-primary/5 backdrop-blur sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground sm:text-xl">
                سجل الطلاب الرسمي المعتمد — شامل لكل الأعوام
              </h2>
              <p className="text-xs text-muted-foreground">
                جميع طلاب المركز عبر كل الأعوام في سجل واحد موحد — يُستدعى الطلاب منه إلى المسابقة
                الرمضانية والمتابعة الشهرية وأي صفحة أخرى
              </p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewColumnDialogOpen(true)}
              className="w-full sm:w-auto gap-1.5 rounded-xl border-dashed border-primary/40 font-bold text-primary hover:bg-primary/10"
            >
              <Plus className="h-4 w-4" /> إضافة عمود جديد
            </Button>
            {customColumns.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setManageColsOpen(true)}
                className="w-full sm:w-auto gap-1 rounded-xl text-xs font-bold"
              >
                <Columns className="h-3.5 w-3.5" /> إدارة الأعمدة ({customColumns.length})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="w-full sm:w-auto gap-1 rounded-xl font-bold"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> تصدير Excel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              className="w-full sm:w-auto gap-1 rounded-xl font-bold"
            >
              <Printer className="h-4 w-4" /> طباعة السجل
            </Button>
          </div>
        </div>

        {/* Duplicate names warning strip */}
        {duplicateGroupsCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="font-bold">
              تنبيه: يوجد {duplicateStudentsCount} طالب ضمن {duplicateGroupsCount} اسمًا مكررًا في
              السجل — تم تمييز أسمائهم باللون الكهرماني داخل الجدول.
            </span>
            <Button
              size="sm"
              variant={duplicatesOnly ? "default" : "outline"}
              onClick={() => setDuplicatesOnly((v) => !v)}
              className={`h-7 rounded-lg px-2.5 text-xs font-bold ${
                duplicatesOnly
                  ? "bg-amber-600 text-white hover:bg-amber-700"
                  : "border-amber-400/70 text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-500/20"
              }`}
            >
              {duplicatesOnly ? "إظهار كل الطلاب" : "عرض الأسماء المكررة فقط"}
            </Button>
          </div>
        )}

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2 pt-2 border-t border-border/60">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم، رقم الهاتف، المعلم/ة..."
              className="h-10 pr-9 rounded-xl border-border/80 bg-background/80 text-xs"
            />
          </div>

          <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
            <SelectTrigger className="h-10 rounded-xl bg-background/80 text-xs font-bold border-border/80">
              <SelectValue placeholder="تصفية حسب المعلم/ة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المعلمين والمعلمات</SelectItem>
              {teacherNames.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="h-10 rounded-xl bg-background/80 text-xs font-bold border-border/80">
              <SelectValue placeholder="تصفية حسب الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {studentStatuses.map((st) => (
                <SelectItem key={st} value={st}>
                  {st}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedGrade} onValueChange={setSelectedGrade}>
            <SelectTrigger
              className={cn(
                "h-10 rounded-xl bg-background/80 text-xs font-bold border-border/80 gap-1",
                selectedGrade !== ALL_GRADES_VALUE &&
                  "border-primary/60 bg-primary/10 text-primary ring-1 ring-primary/30",
              )}
              title="تصفية الطلاب حسب السنة الدراسية وقت الالتحاق"
            >
              <span className="flex min-w-0 items-center gap-1">
                <ListFilter className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <SelectValue placeholder="تصفية حسب السنة الدراسية">
                  {selectedGradeLabel}
                </SelectValue>
              </span>
            </SelectTrigger>
            <SelectContent className="max-h-[60vh]">
              <SelectItem value={ALL_GRADES_VALUE} className="font-bold">
                <span className="flex w-full items-center justify-between gap-3">
                  <span>كل السنوات الدراسية</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary">
                    {students.length}
                  </span>
                </span>
              </SelectItem>
              {gradeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="flex w-full items-center justify-between gap-3">
                    <span>{option.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                        option.count > 0
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {option.count}
                    </span>
                  </span>
                </SelectItem>
              ))}
              {studentsWithoutGradeCount > 0 && (
                <div className="mt-1 border-t border-border/60 px-2 pt-1.5 text-[10px] text-muted-foreground">
                  {studentsWithoutGradeCount} طالب بدون سنة دراسية مسجّلة (يمكن تعبئتها من الخلية
                  داخل الجدول)
                </div>
              )}
            </SelectContent>
          </Select>

          <Select value={selectedGender} onValueChange={setSelectedGender}>
            <SelectTrigger className="h-10 rounded-xl bg-background/80 text-xs font-bold border-border/80">
              <SelectValue placeholder="تصفية حسب الجنس" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأجناس</SelectItem>
              {GENDER_OPTIONS.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* رقائق الفلاتر المفعّلة — تؤكد أن التصفية تعمل وتُظهر النتيجة بعدد الطلاب */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
            <span className="text-[11px] font-bold text-muted-foreground">تصفية مفعّلة:</span>
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onClear}
                title="إزالة هذه التصفية"
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20"
              >
                {chip.label}
                <X className="h-3 w-3" />
              </button>
            ))}
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
              {filteredStudents.length} من {students.length} طالب
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearAllFilters}
              className="h-7 gap-1 rounded-lg px-2 text-[11px] font-bold text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
            >
              <X className="h-3.5 w-3.5" /> مسح كل الفلاتر
            </Button>
          </div>
        )}
      </div>

      {/* Main Students Table */}
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-card/90 shadow-2xl shadow-primary/10 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-background/55 px-4 py-3 print:hidden">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-foreground">جدول الطلاب الرسمي</h3>
            <span className="hidden text-xs text-muted-foreground md:inline">
              (اضغط على اسم أي طالب لفتح ملفه الشامل ومتابعاته عبر جميع الأعوام)
            </span>
            <span className="text-[11px] text-muted-foreground md:hidden">
              اسحب الجدول يمينًا ويسارًا لعرض كل الأعمدة ⇄
            </span>
          </div>
          <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            {filteredStudents.length} طالب
          </div>
        </div>

        <div className="table-scroll max-h-[60vh] overflow-auto md:max-h-[72vh]">
          <table
            className="w-full table-fixed border-separate border-spacing-0 bg-card text-sm whitespace-nowrap"
            style={{ minWidth: tableMinWidth }}
          >
            {/*
              عرض الأعمدة يُثبَّت من <colgroup> فيتطابق الرأس مع الخلايا تمامًا،
              وتصبح المحاذاة موحّدة: الأرقام والقيم القصيرة في الوسط، والاسم يمينًا.
            */}
            <colgroup>
              {TABLE_COLUMNS.map((column) => (
                <col key={column.key} style={{ width: column.width }} />
              ))}
              {customColumns.map((column) => (
                <col key={column.id} style={{ width: CUSTOM_COLUMN_WIDTH }} />
              ))}
              <col style={{ width: ACTIONS_COLUMN_WIDTH }} />
            </colgroup>
            <thead>
              {/*
                كل خلية رأس ثابتة (sticky) بخلفية معتمة خاصة بها — لا نعتمد على
                خلفية الصف لأنها لا تتحرك مع الخلايا الثابتة فتظهر مشكلة
                التداخل عند التمرير.
              */}
              <tr className="text-white font-bold text-xs">
                {TABLE_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      column.key === "index"
                        ? HEAD_CELL_INDEX
                        : column.key === "name"
                          ? HEAD_CELL_NAME
                          : HEAD_CELL,
                      column.align === "right" ? "text-right" : "text-center",
                    )}
                  >
                    <span className="block leading-snug">{column.label}</span>
                  </th>
                ))}

                {/* الأعمدة المخصّصة (تُضاف وتُحذف من زرّ إدارة الأعمدة) */}
                {customColumns.map((column) => (
                  <th key={column.id} className={cn(HEAD_CELL_CUSTOM, "text-center")}>
                    <span className="block leading-snug">{column.name}</span>
                  </th>
                ))}

                <th className={cn(HEAD_CELL_CUSTOM, "text-center")}>
                  <span className="block leading-snug">إجراءات</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={TABLE_COLUMNS.length + customColumns.length + 1}
                    className="p-12 text-center text-muted-foreground"
                  >
                    لا يوجد طلاب مطابقون لمعايير البحث
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, index) => {
                  const current = dirtyMap[student.id] || student;
                  const isDirtyRow = !!dirtyMap[student.id];
                  const dupCount = getDuplicateCountFor(current.name, duplicateNameCounts);
                  const isDuplicateName = dupCount > 1;

                  return (
                    <tr
                      key={student.id}
                      className={`group transition-colors odd:bg-white even:bg-secondary/20 hover:bg-primary/5 ${
                        isDirtyRow ? "bg-amber-50/70" : ""
                      }`}
                    >
                      {/* Index */}
                      <td
                        className={cn(
                          BODY_CELL_STICKY,
                          "font-black tabular-nums text-primary group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950",
                        )}
                      >
                        {index + 1}
                      </td>

                      {/* Student Name: Clickable to open profile */}
                      <td
                        className={cn(
                          "sticky right-12 z-10 overflow-hidden border-b border-l border-border/70 p-1.5 align-middle shadow-[-8px_0_12px_-10px_rgba(0,0,0,0.3)]",
                          isDuplicateName
                            ? "bg-amber-100 group-hover:bg-amber-200 dark:bg-amber-800 dark:group-hover:bg-amber-700"
                            : "bg-card group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950",
                        )}
                      >
                        <div className="flex min-w-0 items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenProfile(student)}
                            className={`flex min-w-0 items-center gap-1.5 text-right font-black group-hover:translate-x-[-2px] transition-transform ${
                              isDuplicateName
                                ? "text-amber-800 hover:text-amber-900 dark:text-amber-300"
                                : "text-primary hover:text-emerald-700 hover:underline"
                            }`}
                            title={
                              isDuplicateName
                                ? `⚠️ اسم مكرر: يوجد ${dupCount} طلاب بنفس الاسم في السجل (${current.name}) — اضغط لفتح الملف والتحقق`
                                : `${current.name || "طالب بدون اسم"} — اضغط لفتح الملف الأكاديمي الشامل للطالب`
                            }
                          >
                            {isDuplicateName && (
                              <span
                                className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-500 text-white"
                                aria-label="اسم مكرر"
                              >
                                <AlertTriangle className="h-3 w-3" />
                              </span>
                            )}
                            <span className="truncate">{current.name || "طالب بدون اسم"}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-60 inline" />
                          </button>
                        </div>
                      </td>

                      {/* Gender */}
                      <td className={BODY_CELL}>
                        <Select
                          value={current.gender || NONE_VALUE}
                          onValueChange={(v) =>
                            updateStudentField(student, "gender", v === NONE_VALUE ? "" : v)
                          }
                        >
                          <SelectTrigger className={CELL_SELECT}>
                            <SelectValue placeholder="الجنس" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>— بدون —</SelectItem>
                            {GENDER_OPTIONS.map((g) => (
                              <SelectItem key={g} value={g}>
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Teacher */}
                      <td className={BODY_CELL}>
                        <Select
                          value={current.teacher || NONE_VALUE}
                          onValueChange={(v) =>
                            updateStudentField(student, "teacher", v === NONE_VALUE ? "" : v)
                          }
                        >
                          <SelectTrigger className={cn(CELL_SELECT, "font-normal")}>
                            <SelectValue placeholder="المعلم/ة" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[60vh]">
                            <SelectItem value={NONE_VALUE}>— بدون —</SelectItem>
                            {current.teacher && !teacherNames.includes(current.teacher) && (
                              <SelectItem value={current.teacher}>{current.teacher}</SelectItem>
                            )}
                            {teacherNames.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Hijri Join Date */}
                      <td className={BODY_CELL}>
                        <Input
                          value={current.hijri_join_date || ""}
                          onChange={(e) =>
                            updateStudentField(student, "hijri_join_date", e.target.value)
                          }
                          placeholder="1443هـ"
                          className={cn(CELL_INPUT, "tabular-nums")}
                        />
                      </td>

                      {/* Initial Memorization before joining */}
                      <td className={cn(BODY_CELL, "bg-amber-500/5")}>
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            type="number"
                            value={current.initial_hifz || ""}
                            onChange={(e) =>
                              updateStudentField(student, "initial_hifz", e.target.value)
                            }
                            placeholder="0"
                            min="0"
                            max="30"
                            title="مقدار الحفظ قبل الالتحاق (عدد الأجزاء)"
                            className={cn(CELL_INPUT_NUMERIC, "max-w-[4.5rem]")}
                          />
                          <span className="shrink-0 text-[11px] text-muted-foreground">جزء</span>
                        </div>
                      </td>

                      {/* Cumulative memorization from the latest registered year */}
                      <td className={cn(BODY_CELL, "bg-emerald-500/5")}>
                        <div className="flex items-center justify-center gap-1 font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                          {current.latest_total_hifz !== undefined &&
                          current.latest_total_hifz !== "" ? (
                            <>
                              <span>{current.latest_total_hifz}</span>
                              <span className="text-[11px] font-normal text-muted-foreground">
                                جزء
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>

                      {/* First Competition Year */}
                      <td className={BODY_CELL}>
                        <Input
                          value={current.first_competition_year || ""}
                          onChange={(e) =>
                            updateStudentField(student, "first_competition_year", e.target.value)
                          }
                          placeholder="1443هـ"
                          className={cn(CELL_INPUT, "tabular-nums")}
                        />
                      </td>

                      {/* Registered years across all competitions */}
                      <td className={BODY_CELL}>
                        {(current.registered_years || []).length > 0 ? (
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            {(current.registered_years || []).map((y) => (
                              <span
                                key={y}
                                title={formatYearKey(y)}
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  y.endsWith("D")
                                    ? "bg-teal-500/15 text-teal-700 dark:text-teal-300"
                                    : "bg-primary/10 text-primary"
                                }`}
                              >
                                {formatYearKeyShort(y)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            غير مسجل بعام بعد
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className={BODY_CELL}>
                        <Select
                          value={current.status || "طبيعي"}
                          onValueChange={(v) => {
                            if (v === "__new_status__") {
                              setStatusTargetStudentId(student.id);
                              setNewStatusDialogOpen(true);
                            } else {
                              updateStudentField(student, "status", v);
                            }
                          }}
                        >
                          <SelectTrigger className={CELL_SELECT}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-[60vh]">
                            {studentStatuses.map((st) => (
                              <SelectItem key={st} value={st}>
                                {st}
                              </SelectItem>
                            ))}
                            <SelectItem value="__new_status__" className="text-primary font-bold">
                              + إضافة حالة جديدة...
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      {/*
                        السنة الدراسية وقت الالتحاق — نفس قائمة "كل السنوات الدراسية"
                        المستخدمة في التصفية، مع خيار الكتابة اليدوية لمن يحتاج صياغة خاصة.
                      */}
                      <td className={cn(BODY_CELL, "bg-primary/5")}>
                        {manualGradeIds.includes(student.id) ? (
                          <div className="flex items-center gap-1">
                            <Input
                              autoFocus
                              value={current.school_grade || ""}
                              onChange={(e) =>
                                updateStudentField(student, "school_grade", e.target.value)
                              }
                              placeholder="اكتب السنة الدراسية"
                              className={CELL_INPUT}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setManualGradeIds((ids) => ids.filter((id) => id !== student.id))
                              }
                              className="h-8 w-8 shrink-0 rounded-lg p-0 text-primary hover:bg-primary/10"
                              title="العودة إلى قائمة السنوات الدراسية"
                            >
                              <ListFilter className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Select
                            value={current.school_grade || NONE_VALUE}
                            onValueChange={(v) => {
                              if (v === MANUAL_GRADE_VALUE) {
                                setManualGradeIds((ids) =>
                                  ids.includes(student.id) ? ids : [...ids, student.id],
                                );
                                return;
                              }
                              updateStudentField(
                                student,
                                "school_grade",
                                v === NONE_VALUE ? "" : v,
                              );
                            }}
                          >
                            <SelectTrigger
                              className={cn(CELL_SELECT, "font-normal")}
                              title="اختر السنة الدراسية من قائمة موحّدة"
                            >
                              <SelectValue placeholder="غير محددة" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[60vh]">
                              <SelectItem value={NONE_VALUE}>— بدون —</SelectItem>
                              {!!current.school_grade?.trim() &&
                                !gradeLabels.includes(current.school_grade.trim()) && (
                                  <SelectItem value={current.school_grade.trim()}>
                                    {current.school_grade.trim()}
                                  </SelectItem>
                                )}
                              {gradeOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                              <SelectItem
                                value={MANUAL_GRADE_VALUE}
                                className="font-bold text-primary"
                              >
                                <span className="flex items-center gap-1">
                                  <PencilLine className="h-3.5 w-3.5" />
                                  إدخال يدوي (كتابة حرة)
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>

                      {/* Guardian Phone */}
                      <td className={BODY_CELL}>
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            value={current.guardian_phone || ""}
                            onChange={(e) =>
                              updateStudentField(student, "guardian_phone", e.target.value)
                            }
                            placeholder="770000000"
                            className={cn(CELL_INPUT, "tracking-wider")}
                            dir="ltr"
                          />
                          {current.guardian_phone && (
                            <a
                              href={`https://wa.me/${current.guardian_phone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-emerald-600/15 p-1.5 text-emerald-700 hover:bg-emerald-600 hover:text-white"
                              title="مراسلة واتساب"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Student Phone */}
                      <td className={BODY_CELL}>
                        <Input
                          value={current.student_phone || ""}
                          onChange={(e) =>
                            updateStudentField(student, "student_phone", e.target.value)
                          }
                          placeholder="770000000"
                          className={cn(CELL_INPUT, "tracking-wider")}
                          dir="ltr"
                        />
                      </td>

                      {/* Dynamic Custom Columns */}
                      {customColumns.map((col) => (
                        <td key={col.id} className={BODY_CELL}>
                          <Input
                            type={col.type === "number" ? "number" : "text"}
                            value={current.custom_fields?.[col.id] || ""}
                            onChange={(e) =>
                              updateStudentCustomField(student, col.id, e.target.value)
                            }
                            placeholder="—"
                            className={cn(
                              CELL_INPUT,
                              col.type === "number" && "tabular-nums font-bold",
                              col.type === "phone" && "tracking-wider",
                            )}
                            dir={col.type === "phone" ? "ltr" : undefined}
                          />
                        </td>
                      ))}

                      {/* Actions */}
                      <td className={cn(BODY_CELL, "border-l-0 text-center")}>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenProfile(student)}
                            className="h-8 w-8 rounded-lg p-0 text-primary hover:bg-primary/10"
                            title="عرض الملف والتبويبات"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteStudent(student.id)}
                            className="h-8 w-8 rounded-lg p-0 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                            title="حذف الطالب من السجل الشامل نهائياً (كل الأعوام)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Profile Modal */}
      <StudentProfileModal
        student={selectedStudent}
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
        onStudentUpdated={onUpdate}
        initialYear={activeYear || undefined}
        customColumns={customColumns}
      />

      {/* Dialog: Add New Dynamic Column */}
      <Dialog open={newColumnDialogOpen} onOpenChange={setNewColumnDialogOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              إضافة عمود جديد إلى جدول الطلاب
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-bold text-foreground">عنوان / اسم العمود</label>
              <Input
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="مثال: رقم الهوية، عنوان السكن، ملاحظات صحية..."
                className="h-10 mt-1 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="font-bold text-foreground">نوع البيانات</label>
              <Select
                value={newColumnType}
                onValueChange={(v) => setNewColumnType(v as CustomColumnDef["type"])}
              >
                <SelectTrigger className="h-10 mt-1 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">نص عادي</SelectItem>
                  <SelectItem value="number">أرقام</SelectItem>
                  <SelectItem value="date">تاريخ</SelectItem>
                  <SelectItem value="phone">رقم هاتف</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewColumnDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreateColumn} className="gap-1 rounded-xl">
              <Plus className="h-4 w-4" /> إنشاء العمود
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add New Status */}
      <Dialog open={newStatusDialogOpen} onOpenChange={setNewStatusDialogOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة حالة طالب جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-bold text-foreground">اسم الحالة الجديدة</label>
              <Input
                value={newStatusName}
                onChange={(e) => setNewStatusName(e.target.value)}
                placeholder="مثال: ذوي الدخل المحدود، متفوق..."
                className="h-10 mt-1 rounded-xl text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setNewStatusName("");
                setStatusTargetStudentId(null);
                setNewStatusDialogOpen(false);
              }}
            >
              إلغاء
            </Button>
            <Button onClick={handleCreateStatus} className="gap-1 rounded-xl">
              <Plus className="h-4 w-4" /> إضافة الحالة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Manage Custom Columns */}
      <Dialog open={manageColsOpen} onOpenChange={setManageColsOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Columns className="h-5 w-5 text-primary" />
              إدارة الأعمدة المخصصة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-64 overflow-y-auto">
            {customColumns.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">لا توجد أعمدة مخصصة</p>
            ) : (
              customColumns.map((col) => (
                <div
                  key={col.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-secondary/30"
                >
                  <div>
                    <span className="font-bold text-sm text-foreground">{col.name}</span>
                    <span className="text-xs text-muted-foreground ms-2">({col.type || "نص"})</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm(`هل تريد حذف عمود "${col.name}"؟`)) return;
                      await onDeleteCustomColumn(col.id);
                      toast({ title: "تم حذف العمود", variant: "destructive" });
                    }}
                    className="text-rose-500 hover:text-rose-600 h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageColsOpen(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
