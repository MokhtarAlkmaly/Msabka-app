import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export type SortField =
  | "index"
  | "name"
  | "teacher"
  | "baseHifz"
  | "parts"
  | "totalHifz"
  | "annual"
  | "recitation"
  | "memorization"
  | "total"
  | "status"
  | "grade"
  | "prize"
  | "statusPrize"
  | "rank";
export type SortDirection = "asc" | "desc" | null;

interface Props {
  currentYear: string;
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

/**
 * ارتفاع موحّد لكل خلايا صف الرأس الأول.
 * مهم: الصف الثاني من الرأس يثبّت عند top-16، لذلك يجب أن يكون ارتفاع
 * الصف الأول مطابقًا تمامًا لهذه القيمة (64px) وإلا يحدث تداخل بين
 * صفوف الرأس عند التمرير. نصب الرؤوس text-xs بحيث تكفي 3 أسطر ملتفة.
 */
const TOP_ROW_HEIGHT = "h-16"; // 64px = top-16 لصف رؤوس الدرجات
const TOP_ROW_CELLS = `sticky top-0 ${TOP_ROW_HEIGHT} align-middle bg-primary`;
const SUB_ROW_CELLS = `sticky top-16 bg-primary`;

const SortIcon = ({
  field,
  sortField,
  sortDirection,
}: {
  field: SortField;
  sortField: SortField | null;
  sortDirection: SortDirection;
}) => {
  if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40 inline-block mr-1" />;
  if (sortDirection === "asc")
    return <ArrowUp className="h-3 w-3 inline-block mr-1 text-primary-foreground" />;
  return <ArrowDown className="h-3 w-3 inline-block mr-1 text-primary-foreground" />;
};

export const TableHeader = ({ currentYear, sortField, sortDirection, onSort }: Props) => {
  const sortableHeader = (
    label: string,
    field: SortField,
    extra?: string,
    rowSpan?: number,
    zClass = "z-20",
  ) => (
    <th
      key={field}
      rowSpan={rowSpan}
      className={`border-b border-l border-primary-foreground/10 p-1.5 min-w-[50px] ${TOP_ROW_CELLS} ${zClass} cursor-pointer hover:bg-primary/85 select-none transition-colors ${extra || ""}`}
      onClick={() => onSort(field)}
    >
      <span className="flex items-center justify-center gap-0.5 whitespace-normal text-center leading-tight">
        {label}
        <SortIcon field={field} sortField={sortField} sortDirection={sortDirection} />
      </span>
    </th>
  );

  const subHeader = (label: string, field: SortField) => (
    <th
      key={field}
      className={`border-b border-l border-primary-foreground/10 p-1.5 min-w-[70px] h-10 align-middle ${SUB_ROW_CELLS} z-20 cursor-pointer hover:bg-primary/85 select-none transition-colors`}
      onClick={() => onSort(field)}
    >
      <span className="flex items-center justify-center gap-0.5 whitespace-normal text-center leading-tight">
        {label}
        <SortIcon field={field} sortField={sortField} sortDirection={sortDirection} />
      </span>
    </th>
  );

  const staticHeader = (label: string, extra?: string, rowSpan?: number) => (
    <th
      key={label}
      rowSpan={rowSpan}
      className={`border-b border-l border-primary-foreground/10 p-1.5 min-w-[60px] ${TOP_ROW_CELLS} z-20 align-middle ${extra || ""}`}
    >
      <span className="flex items-center justify-center whitespace-normal text-center leading-tight">
        {label}
      </span>
    </th>
  );

  return (
    <thead className="bg-primary text-primary-foreground text-xs whitespace-normal">
      <tr>
        {sortableHeader("م", "index", "right-0 w-[50px] min-w-[50px]", 2, "z-40")}
        {sortableHeader("اسم الطالب/ة", "name", "right-[50px] min-w-[280px] w-[280px]", 2, "z-40")}
        {sortableHeader("المعلم/ة", "teacher", "min-w-[200px] w-[200px]", 2)}
        {sortableHeader("الحفظ السابق", "baseHifz", "min-w-[80px]", 2)}
        {sortableHeader(`حفظ جديد (${currentYear})`, "parts", "min-w-[80px]", 2)}
        {sortableHeader("الإجمالي التراكمي", "totalHifz", "min-w-[100px]", 2)}
        <th
          colSpan={4}
          className={`border-b border-l border-primary-foreground/10 p-1.5 ${TOP_ROW_CELLS} z-20 align-middle`}
        >
          الدرجات
        </th>
        {sortableHeader("الحالة", "status", "min-w-[70px]", 2)}
        {sortableHeader("التقدير", "grade", "min-w-[80px]", 2)}
        {sortableHeader("المكافأة", "prize", "min-w-[80px]", 2)}
        {sortableHeader("المكافأة حسب الحالة", "statusPrize", "min-w-[96px]", 2)}
        {sortableHeader("ترتيب", "rank", "min-w-[60px]", 2)}
        {staticHeader("تقرير", "min-w-[60px]", 2)}
        {staticHeader("حذف", "min-w-[60px]", 2)}
      </tr>
      <tr>
        {subHeader("سنة (20)", "annual")}
        {subHeader("تلاوة (20)", "recitation")}
        {subHeader("حفظ (60)", "memorization")}
        {subHeader("مجموع", "total")}
      </tr>
    </thead>
  );
};
