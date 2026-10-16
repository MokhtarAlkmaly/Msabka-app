import { useState, useRef } from "react";
import { Student, START_YEAR, END_YEAR, HifzHistory } from "@/types/student";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Printer } from "lucide-react";
import { loadYearData, loadHifzHistory } from "@/utils/storage";
import { resolveBaseHifz, calculateGrade, calculatePrize } from "@/utils/calculations";
import logo from "@/assets/logo.png";
import { BRAND_PRINT_TITLE } from "@/lib/brand";

interface Props {
  student: Student;
}

interface YearReport {
  year: number;
  baseHifz: number;
  parts: number;
  totalHifz: number;
  annual: number;
  recitation: number;
  memorization: number;
  totalScore: number;
  grade: string;
  prize: number;
  statusPrize: number;
  isActive: boolean;
}

export const StudentReport = ({ student }: Props) => {
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [reports, setReports] = useState<YearReport[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  const availableYears = Array.from(
    { length: END_YEAR - START_YEAR + 1 },
    (_, i) => START_YEAR + i,
  );

  const toggleYear = (year: number) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year].sort(),
    );
  };

  const selectAll = () => {
    setSelectedYears(selectedYears.length === availableYears.length ? [] : [...availableYears]);
  };

  const generateReport = async (): Promise<YearReport[]> => {
    const history = await loadHifzHistory(student.id);
    const results: YearReport[] = [];

    for (const year of selectedYears) {
      const yearData = await loadYearData(year.toString(), student.id);
      const baseHifz = resolveBaseHifz(history, year, yearData.baseHifz);
      const parts = parseFloat(yearData.parts) || 0;
      const totalHifz = Math.min(baseHifz + parts, 30);
      const annual = parseFloat(yearData.annual) || 0;
      const recitation = parseFloat(yearData.recitation) || 0;
      const memorization = parseFloat(yearData.memorization) || 0;
      const totalScore = Math.min(annual + recitation + memorization, 100);
      const { grade, pricePerPart } = calculateGrade(totalScore);
      const prize = calculatePrize(parts, pricePerPart);
      const isActive = parts > 0 || totalScore > 0;
      const statusPrize = parseFloat(yearData.statusPrize || "0");

      results.push({
        year,
        baseHifz,
        parts,
        totalHifz,
        annual,
        recitation,
        memorization,
        totalScore,
        grade,
        prize,
        statusPrize,
        isActive,
      });
    }
    return results;
  };

  const handlePrint = async () => {
    const { printHtmlDocument } = await import("@/utils/nativePrint");
    const data = await generateReport();
    setReports(data);
    setShowReport(true);

    const calcTotalPrize = data.reduce((sum, r) => sum + r.prize, 0);
    const calcTotalStatusPrize = data.reduce((sum, r) => sum + r.statusPrize, 0);

    const esc = (s: unknown) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const rows = data
      .map(
        (r) => `<tr>
      <td>${r.year}هـ</td><td>${r.baseHifz || "-"}</td><td>${r.parts || "-"}</td>
      <td>${r.totalHifz >= 30 ? "خاتم ✨" : r.totalHifz || "-"}</td>
      <td>${esc(r.annual || "-")}</td><td>${esc(r.recitation || "-")}</td><td>${esc(r.memorization || "-")}</td>
      <td>${r.totalScore || "-"}</td><td>${esc(r.grade || "-")}</td>
      <td class="${r.isActive ? "active" : "inactive"}">${r.isActive ? "نشط" : "منقطع"}</td>
      <td>${r.prize.toLocaleString()}</td><td>${r.statusPrize.toLocaleString()}</td>
    </tr>`,
      )
      .join("");

    const fullHtml = `
      <html dir="rtl"><head><title>تقرير ${esc(student.name)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px; color: #1a3a2a; }
        .header { text-align: center; margin-bottom: 24px; border-bottom: 3px solid #2d7a52; padding-bottom: 16px; }
        .header img { height: 80px; margin-bottom: 8px; }
        .header h1 { font-size: 20px; color: #2d7a52; }
        .header h2 { font-size: 16px; color: #555; margin-top: 4px; }
        .student-info { background: #f0f7f3; padding: 12px; border-radius: 8px; margin-bottom: 20px; display: flex; gap: 24px; }
        .student-info div { font-size: 14px; }
        .student-info strong { color: #2d7a52; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
        th { background: #2d7a52; color: white; padding: 8px 4px; border: 1px solid #1a5a38; }
        td { padding: 6px 4px; border: 1px solid #ccc; text-align: center; }
        tr:nth-child(even) { background: #f9fdfb; }
        .total-row { background: #e8f5ee !important; font-weight: bold; font-size: 14px; }
        .total-row td { border-top: 2px solid #2d7a52; }
        .active { color: #16a34a; font-weight: bold; }
        .inactive { color: #dc2626; font-weight: bold; }
        .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #888; border-top: 1px solid #ddd; padding-top: 12px; }
        @media print { body { padding: 10px; } }
      </style></head><body>
        <div class="header">
          <img src="${logo}" alt="الشعار" />
          <h1>${BRAND_PRINT_TITLE}</h1>
          <h2>تقرير المسابقة الرمضانية - ${esc(student.name)}</h2>
        </div>
        <div class="student-info">
          <div><strong>الطالب/ة:</strong> ${esc(student.name)}</div>
          <div><strong>المعلم/ة:</strong> ${esc(student.teacher)}</div>
        </div>
        <table>
          <thead><tr>
            <th>العام</th><th>الحفظ السابق</th><th>حفظ جديد</th><th>الإجمالي</th>
            <th>سنة</th><th>تلاوة</th><th>حفظ</th><th>المجموع</th>
            <th>التقدير</th><th>الحالة</th><th>المكافأة</th><th>المكافأة حسب الحالة</th>
          </tr></thead>
          <tbody>
            ${rows}
            <tr class="total-row">
              <td colspan="10">إجمالي المكافآت</td>
              <td>${calcTotalPrize.toLocaleString()}</td>
              <td>${calcTotalStatusPrize.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        <div class="footer">
          تصميم أ/ مختار الكمالي - ${new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
        </div>
      </body></html>
    `;
    printHtmlDocument(fullHtml, `تقرير_${student.name}`);
  };

  const totalPrize = reports.reduce((sum, r) => sum + r.prize, 0);
  const totalStatusPrize = reports.reduce((sum, r) => sum + r.statusPrize, 0);

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setShowReport(false);
          setReports([]);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="تقرير الطالب/ة">
          <FileText className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>تقرير الطالب/ة: {student.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={selectAll}>
              {selectedYears.length === availableYears.length ? "إلغاء الكل" : "تحديد الكل"}
            </Button>
            {availableYears.map((year) => (
              <label key={year} className="flex items-center gap-1 text-sm cursor-pointer">
                <Checkbox
                  checked={selectedYears.includes(year)}
                  onCheckedChange={() => toggleYear(year)}
                />
                {year}هـ
              </label>
            ))}
          </div>

          <Button onClick={handlePrint} disabled={selectedYears.length === 0} className="gap-2">
            <Printer className="h-4 w-4" />
            طباعة التقرير PDF
          </Button>

          {showReport && reports.length > 0 && (
            <div ref={reportRef}>
              <div className="header">
                <img src={logo} alt="الشعار" />
                <h1>{BRAND_PRINT_TITLE}</h1>
                <h2>تقرير المسابقة الرمضانية - {student.name}</h2>
              </div>
              <div className="student-info">
                <div>
                  <strong>الطالب/ة:</strong> {student.name}
                </div>
                <div>
                  <strong>المعلم/ة:</strong> {student.teacher}
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>العام</th>
                    <th>الحفظ السابق</th>
                    <th>حفظ جديد</th>
                    <th>الإجمالي</th>
                    <th>سنة</th>
                    <th>تلاوة</th>
                    <th>حفظ</th>
                    <th>المجموع</th>
                    <th>التقدير</th>
                    <th>الحالة</th>
                    <th>المكافأة</th>
                    <th>المكافأة حسب الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.year}>
                      <td>{r.year}هـ</td>
                      <td>{r.baseHifz || "-"}</td>
                      <td>{r.parts || "-"}</td>
                      <td>{r.totalHifz >= 30 ? "خاتم ✨" : r.totalHifz || "-"}</td>
                      <td>{r.annual || "-"}</td>
                      <td>{r.recitation || "-"}</td>
                      <td>{r.memorization || "-"}</td>
                      <td>{r.totalScore || "-"}</td>
                      <td>{r.grade || "-"}</td>
                      <td className={r.isActive ? "active" : "inactive"}>
                        {r.isActive ? "نشط" : "منقطع"}
                      </td>
                      <td>{r.prize.toLocaleString()}</td>
                      <td>{r.statusPrize.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan={10}>إجمالي المكافآت</td>
                    <td>{totalPrize.toLocaleString()}</td>
                    <td>{totalStatusPrize.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
              <div className="footer">
                تصميم أ/ مختار الكمالي -{" "}
                {new Date().toLocaleDateString("ar-EG", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
