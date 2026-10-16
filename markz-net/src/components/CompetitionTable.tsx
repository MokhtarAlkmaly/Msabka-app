import { useState, useMemo, useCallback, useEffect } from "react";
import { Student, HifzHistory, YearData } from "@/types/student";
import { TableHeader } from "./table/TableHeader";
import { SortField, SortDirection } from "./table/TableHeader";
import { TableRow } from "./table/TableRow";
import { TableFilters } from "./table/TableFilters";
import { calculateGrade, resolveBaseHifz } from "@/utils/calculations";
import { getDuplicateNameCounts, getDuplicateCountFor } from "@/utils/studentNames";
import logo from "@/assets/logo.png";
import { BRAND_PRINT_TITLE } from "@/lib/brand";
import { getTableFilters, setTableFilters } from "@/utils/storage";

interface DirtyData {
  name: string;
  teacher: string;
  history: HifzHistory;
  yearData: YearData;
}

interface Props {
  students: Student[];
  currentYear: string;
  competitionLabel?: string;
  onUpdate: () => void;
  onDelete: (id: number) => void;
  dirtyMap: Record<number, DirtyData>;
  onDirtyChange: (studentId: number, data: DirtyData) => void;
  teacherNames?: string[];
}

export const CompetitionTable = ({
  students,
  currentYear,
  competitionLabel = "المسابقة الرمضانية",
  onUpdate,
  onDelete,
  dirtyMap,
  onDirtyChange,
  teacherNames = [],
}: Props) => {
  const STORAGE_KEY = "competitionTable.filters";
  type Persisted = {
    selectedTeacher: string;
    nameFilter: string;
    statusFilter: string;
    gradeFilter: string;
    partsFilter: string;
    sortField: SortField | null;
    sortDirection: SortDirection;
    updatedAt?: number;
  };
  const loadPersisted = (): Partial<Persisted> => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  };
  const saved = loadPersisted();
  const [selectedTeacher, setSelectedTeacher] = useState<string>(saved.selectedTeacher ?? "all");
  const [nameFilter, setNameFilter] = useState<string>(saved.nameFilter ?? "");
  const [statusFilter, setStatusFilter] = useState<string>(saved.statusFilter ?? "all");
  const [gradeFilter, setGradeFilter] = useState<string>(saved.gradeFilter ?? "all");
  const [partsFilter, setPartsFilter] = useState<string>(saved.partsFilter ?? "");
  const [sortField, setSortField] = useState<SortField | null>(saved.sortField ?? null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(saved.sortDirection ?? null);
  const [cloudLoaded, setCloudLoaded] = useState(false);

  // Pull filter settings from cloud once on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remote = (await getTableFilters<Partial<Persisted>>()) || {};
        const localUpdated = saved.updatedAt ?? 0;
        const remoteUpdated = remote.updatedAt ?? 0;
        // Only override local state if cloud copy is strictly newer
        if (
          !cancelled &&
          remote &&
          Object.keys(remote).length > 0 &&
          remoteUpdated > localUpdated
        ) {
          if (remote.selectedTeacher !== undefined) setSelectedTeacher(remote.selectedTeacher);
          if (remote.nameFilter !== undefined) setNameFilter(remote.nameFilter);
          if (remote.statusFilter !== undefined) setStatusFilter(remote.statusFilter);
          if (remote.gradeFilter !== undefined) setGradeFilter(remote.gradeFilter);
          if (remote.partsFilter !== undefined) setPartsFilter(remote.partsFilter);
          if (remote.sortField !== undefined) setSortField(remote.sortField);
          if (remote.sortDirection !== undefined) setSortDirection(remote.sortDirection);
        }
      } catch (e) {
        /* offline ok */
      } finally {
        if (!cancelled) setCloudLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const data: Persisted = {
      selectedTeacher,
      nameFilter,
      statusFilter,
      gradeFilter,
      partsFilter,
      sortField,
      sortDirection,
      updatedAt: Date.now(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
    if (!cloudLoaded) return;
    if (!navigator.onLine) return;
    const pushToCloud = async () => {
      try {
        await setTableFilters(data);
      } catch {
        /* ignore */
      }
    };
    const handle = setTimeout(pushToCloud, 800);
    // Flush immediately if user closes/hides the tab before debounce fires
    const flush = () => {
      clearTimeout(handle);
      pushToCloud();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(handle);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [
    selectedTeacher,
    nameFilter,
    statusFilter,
    gradeFilter,
    partsFilter,
    sortField,
    sortDirection,
    cloudLoaded,
  ]);

  const savePersistedSettings = useCallback(
    (overrides: Partial<Persisted> = {}) => {
      const data: Persisted = {
        selectedTeacher,
        nameFilter,
        statusFilter,
        gradeFilter,
        partsFilter,
        sortField,
        sortDirection,
        updatedAt: Date.now(),
        ...overrides,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        /* ignore */
      }
    },
    [selectedTeacher, nameFilter, statusFilter, gradeFilter, partsFilter, sortField, sortDirection],
  );

  const handleSort = useCallback(
    (field: SortField) => {
      let nextSortField: SortField | null = field;
      let nextSortDirection: SortDirection = "asc";

      if (sortField === field) {
        if (sortDirection === "asc") nextSortDirection = "desc";
        else if (sortDirection === "desc") {
          nextSortField = null;
          nextSortDirection = null;
        }
      }

      savePersistedSettings({ sortField: nextSortField, sortDirection: nextSortDirection });
      setSortField(nextSortField);
      setSortDirection(nextSortDirection);
    },
    [sortField, sortDirection, savePersistedSettings],
  );

  const teachers = useMemo(() => {
    const uniqueTeachers = Array.from(new Set(students.map((s) => s.teacher).filter(Boolean)));
    return uniqueTeachers.sort((a, b) => a.localeCompare(b, "ar"));
  }, [students]);

  // كشف الأسماء المكررة (بعد التطبيع) لتمييزها داخل الجدول
  const duplicateNameCounts = useMemo(() => getDuplicateNameCounts(students), [students]);

  const currentYearNum = parseInt(currentYear);

  const getStudentSortValue = useCallback(
    (student: Student, field: SortField): string | number => {
      const parts = parseFloat(student.yearData?.parts || "0");
      const totalScore = parseFloat(student.yearData?.total || "0");
      const isActive = parts > 0 || totalScore > 0;
      const baseHifz = resolveBaseHifz(
        student.hifzHistory || {},
        currentYearNum,
        student.yearData?.baseHifz,
      );

      switch (field) {
        case "name":
          return student.name || "";
        case "teacher":
          return student.teacher || "";
        case "baseHifz":
          return baseHifz;
        case "parts":
          return parts;
        case "totalHifz":
          return Math.min(baseHifz + parts, 30);
        case "annual":
          return parseFloat(student.yearData?.annual || "0");
        case "recitation":
          return parseFloat(student.yearData?.recitation || "0");
        case "memorization":
          return parseFloat(student.yearData?.memorization || "0");
        case "total":
          return totalScore;
        case "status":
          return isActive ? 1 : 0;
        case "grade": {
          const { grade } = calculateGrade(totalScore);
          const order: Record<string, number> = {
            ممتاز: 5,
            "جيد جداً": 4,
            جيد: 3,
            مقبول: 2,
            ضعيف: 1,
            "": 0,
          };
          return order[grade] || 0;
        }
        case "prize":
          return parseFloat(student.yearData?.prize || "0");
        case "statusPrize":
          return parseFloat(student.yearData?.statusPrize || "0");
        case "rank":
          return parseFloat(student.yearData?.rank || "0") || 9999;
        default:
          return 0;
      }
    },
    [currentYearNum],
  );

  const filteredStudents = useMemo(() => {
    const filtered = students.filter((student) => {
      if (selectedTeacher !== "all" && student.teacher !== selectedTeacher) return false;
      if (nameFilter && !student.name.includes(nameFilter)) return false;

      const parts = parseFloat(student.yearData?.parts || "0");
      const total = parseFloat(student.yearData?.total || "0");
      const isActive = parts > 0 || total > 0;

      if (statusFilter !== "all") {
        if (statusFilter === "active" && !isActive) return false;
        if (statusFilter === "inactive" && isActive) return false;
      }

      if (gradeFilter !== "all") {
        const totalScore = parseFloat(student.yearData?.total || "0");
        const { grade } = calculateGrade(totalScore);
        if (grade !== gradeFilter) return false;
      }

      if (partsFilter) {
        const minParts = parseFloat(partsFilter) || 0;
        if (parts < minParts) return false;
      }

      return true;
    });

    if (sortField && sortDirection) {
      filtered.sort((a, b) => {
        const aVal = getStudentSortValue(a, sortField);
        const bVal = getStudentSortValue(b, sortField);
        const cmp =
          typeof aVal === "string"
            ? aVal.localeCompare(bVal as string, "ar")
            : (aVal as number) - (bVal as number);
        return sortDirection === "asc" ? cmp : -cmp;
      });
    }

    return filtered;
  }, [
    students,
    selectedTeacher,
    nameFilter,
    statusFilter,
    gradeFilter,
    partsFilter,
    sortField,
    sortDirection,
    getStudentSortValue,
  ]);

  const hasFilters =
    selectedTeacher !== "all" ||
    nameFilter !== "" ||
    statusFilter !== "all" ||
    gradeFilter !== "all" ||
    partsFilter !== "";

  const getFilterDescription = () => {
    const parts: string[] = [];
    if (selectedTeacher !== "all") parts.push(`المعلم/ة: ${selectedTeacher}`);
    if (statusFilter !== "all")
      parts.push(`الحالة: ${statusFilter === "active" ? "نشط" : "منقطع"}`);
    if (gradeFilter !== "all") parts.push(`التقدير: ${gradeFilter}`);
    if (partsFilter) parts.push(`الحفظ الجديد ≥ ${partsFilter}`);
    if (nameFilter) parts.push(`الاسم: ${nameFilter}`);
    return parts.join(" | ");
  };

  const handlePrintFiltered = async () => {
    const { printHtmlDocument } = await import("@/utils/nativePrint");

    const rows = filteredStudents
      .map((s, i) => {
        const parts = parseFloat(s.yearData?.parts || "0");
        const totalScore = parseFloat(s.yearData?.total || "0");
        const isActive = parts > 0 || totalScore > 0;
        const { grade } = calculateGrade(totalScore);
        const prize = parseFloat(s.yearData?.prize || "0");
        const statusPrize = parseFloat(s.yearData?.statusPrize || "0");

        return `<tr>
        <td>${i + 1}</td>
        <td>${s.name}</td>
        <td>${s.teacher}</td>
        <td>${s.yearData?.baseHifz || "-"}</td>
        <td>${s.yearData?.parts || "-"}</td>
        <td>${s.yearData?.totalHifz || "-"}</td>
        <td>${s.yearData?.annual || "-"}</td>
        <td>${s.yearData?.recitation || "-"}</td>
        <td>${s.yearData?.memorization || "-"}</td>
        <td>${totalScore || "-"}</td>
        <td class="${isActive ? "active" : "inactive"}">${isActive ? "نشط" : "منقطع"}</td>
        <td>${grade || "-"}</td>
        <td>${prize.toLocaleString()}</td>
        <td>${statusPrize.toLocaleString()}</td>
      </tr>`;
      })
      .join("");

    const totalPrize = filteredStudents.reduce(
      (sum, s) => sum + parseFloat(s.yearData?.prize || "0"),
      0,
    );
    const totalStatusPrize = filteredStudents.reduce(
      (sum, s) => sum + parseFloat(s.yearData?.statusPrize || "0"),
      0,
    );

    const fullHtml = `
      <html dir="rtl"><head><title>تقرير مصفى - ${currentYear}هـ</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px; color: #1a3a2a; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #2d7a52; padding-bottom: 12px; }
        .header img { height: 80px; margin-bottom: 8px; }
        .header h1 { font-size: 20px; color: #2d7a52; }
        .header h2 { font-size: 16px; color: #555; margin-top: 4px; }
        .filter-info { background: #f0f7f3; padding: 10px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
        .filter-info strong { color: #2d7a52; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #2d7a52; color: white; padding: 6px 3px; border: 1px solid #1a5a38; }
        td { padding: 5px 3px; border: 1px solid #ccc; text-align: center; }
        tr:nth-child(even) { background: #f9fdfb; }
        .total-row { background: #e8f5ee !important; font-weight: bold; }
        .total-row td { border-top: 2px solid #2d7a52; }
        .active { color: #16a34a; font-weight: bold; }
        .inactive { color: #dc2626; font-weight: bold; }
        .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #888; }
        .count { margin-bottom: 10px; font-size: 13px; }
        @media print { body { padding: 10px; } @page { size: landscape; margin: 10mm; } }
      </style></head><body>
        <div class="header">
          <img src="${logo}" alt="الشعار" />
          <h1>${BRAND_PRINT_TITLE}</h1>
          <h2>كشف ${competitionLabel} - ${currentYear}هـ</h2>
        </div>
        <div class="filter-info"><strong>التصفية:</strong> ${getFilterDescription()}</div>
        <div class="count">عدد الطلاب: <strong>${filteredStudents.length}</strong></div>
        <table>
          <thead><tr>
            <th>م</th><th>الاسم</th><th>المعلم/ة</th><th>الحفظ السابق</th><th>حفظ جديد</th>
            <th>الإجمالي</th><th>سنة</th><th>تلاوة</th><th>حفظ</th><th>المجموع</th>
            <th>الحالة</th><th>التقدير</th><th>المكافأة</th><th>المكافأة حسب الحالة</th>
          </tr></thead>
          <tbody>
            ${rows}
            <tr class="total-row">
              <td colspan="12">إجمالي المكافآت</td>
              <td>${totalPrize.toLocaleString()}</td>
              <td>${totalStatusPrize.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        <div class="footer">تصميم أ/ مختار الكمالي - ${new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}</div>
      </body></html>
    `;
    printHtmlDocument(fullHtml, `تقرير_${competitionLabel}_${currentYear}`);
  };

  return (
    <div className="space-y-4">
      <TableFilters
        teachers={teachers}
        selectedTeacher={selectedTeacher}
        onTeacherChange={setSelectedTeacher}
        nameFilter={nameFilter}
        onNameFilterChange={setNameFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        gradeFilter={gradeFilter}
        onGradeFilterChange={setGradeFilter}
        partsFilter={partsFilter}
        onPartsFilterChange={setPartsFilter}
        onPrintFiltered={handlePrintFiltered}
        hasFilters={hasFilters}
      />

      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-card/90 shadow-2xl shadow-primary/10 backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-background/55 px-4 py-3 print:hidden">
          <div>
            <h3 className="font-black text-foreground">كشف الطلاب</h3>
            <p className="text-xs text-muted-foreground">
              اسحب يمين/يسار لرؤية كل الأعمدة على الجوال
            </p>
          </div>
          <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            {filteredStudents.length} طالب/ة
          </div>
        </div>
        <div className="table-scroll max-h-[60vh] overflow-auto md:max-h-[72vh]">
          <table className="w-full min-w-[1480px] table-fixed border-separate border-spacing-0 bg-card text-sm whitespace-nowrap">
            <TableHeader
              currentYear={currentYear}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
            <tbody>
              {filteredStudents.map((student, index) => (
                <TableRow
                  key={`${student.id}-${currentYear}`}
                  student={student}
                  index={index + 1}
                  currentYear={currentYear}
                  onDelete={onDelete}
                  onDirtyChange={onDirtyChange}
                  teacherNames={teacherNames}
                  duplicateNameCount={getDuplicateCountFor(student.name, duplicateNameCounts)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredStudents.length === 0 && (
        <div className="rounded-[1.5rem] border border-dashed border-primary/20 bg-card/70 py-12 text-center text-muted-foreground">
          لا توجد بيانات تطابق معايير البحث
        </div>
      )}
    </div>
  );
};
