import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export type SortField = 'index' | 'name' | 'teacher' | 'baseHifz' | 'parts' | 'totalHifz' | 'annual' | 'recitation' | 'memorization' | 'total' | 'status' | 'grade' | 'prize' | 'statusPrize' | 'rank';
export type SortDirection = 'asc' | 'desc' | null;

interface Props {
  currentYear: string;
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

const SortIcon = ({ field, sortField, sortDirection }: { field: SortField; sortField: SortField | null; sortDirection: SortDirection }) => {
  if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40 inline-block mr-1" />;
  if (sortDirection === 'asc') return <ArrowUp className="h-3 w-3 inline-block mr-1 text-primary-foreground" />;
  return <ArrowDown className="h-3 w-3 inline-block mr-1 text-primary-foreground" />;
};

export const TableHeader = ({ currentYear, sortField, sortDirection, onSort }: Props) => {
  const sortableHeader = (label: string, field: SortField, extra?: string, rowSpan?: number) => (
    <th
      rowSpan={rowSpan}
      className={`border-b border-l border-primary-foreground/10 p-2 min-w-[50px] h-[44px] sticky top-0 z-20 bg-primary cursor-pointer hover:bg-primary/85 select-none transition-colors ${extra || ''}`}
      onClick={() => onSort(field)}
    >
      <span className="flex items-center justify-center gap-0.5 whitespace-normal text-center leading-tight">
        {label}
        <SortIcon field={field} sortField={sortField} sortDirection={sortDirection} />
      </span>
    </th>
  );

  return (
    <thead className="bg-primary text-primary-foreground whitespace-normal">
      <tr>
        {sortableHeader('م', 'index', 'right-0 z-40 w-[50px] min-w-[50px]', 2)}
        {sortableHeader('اسم الطالبة', 'name', 'right-[50px] z-40 min-w-[200px] w-[200px]', 2)}
        {sortableHeader('المعلمة', 'teacher', 'min-w-[200px] w-[200px]', 2)}
        <th rowSpan={2} className="border-b border-l border-primary-foreground/10 p-2 min-w-[80px] sticky top-0 z-20 bg-primary cursor-pointer hover:bg-primary/85 select-none transition-colors" onClick={() => onSort('baseHifz')}>
          <span className="flex items-center justify-center gap-0.5 whitespace-normal text-center leading-tight">الحفظ السابق<SortIcon field="baseHifz" sortField={sortField} sortDirection={sortDirection} /></span>
        </th>
        {sortableHeader(`حفظ جديد (${currentYear})`, 'parts', 'min-w-[80px]', 2)}
        {sortableHeader('الإجمالي التراكمي', 'totalHifz', 'min-w-[100px]', 2)}
        <th colSpan={4} className="border-b border-l border-primary-foreground/10 p-2 sticky top-0 z-20 bg-primary h-[44px]">الدرجات</th>
        {sortableHeader('الحالة', 'status', 'min-w-[70px]', 2)}
        {sortableHeader('التقدير', 'grade', 'min-w-[80px]', 2)}
        {sortableHeader('المكافأة', 'prize', 'min-w-[80px]', 2)}
        {sortableHeader('المكافأة حسب الحالة', 'statusPrize', 'min-w-[90px]', 2)}
        {sortableHeader('ترتيب', 'rank', 'min-w-[60px]', 2)}
        <th rowSpan={2} className="border-b border-l border-primary-foreground/10 p-2 min-w-[60px] sticky top-0 z-20 bg-primary">تقرير</th>
        <th rowSpan={2} className="border-b border-l border-primary-foreground/10 p-2 min-w-[60px] sticky top-0 z-20 bg-primary">حذف</th>
      </tr>
      <tr>
        <th className="border-b border-l border-primary-foreground/10 p-2 min-w-[70px] sticky top-[44px] z-20 bg-primary cursor-pointer hover:bg-primary/85 select-none transition-colors" onClick={() => onSort('annual')}>
          <span className="flex items-center justify-center gap-0.5 whitespace-normal text-center leading-tight">سنة (20)<SortIcon field="annual" sortField={sortField} sortDirection={sortDirection} /></span>
        </th>
        <th className="border-b border-l border-primary-foreground/10 p-2 min-w-[70px] sticky top-[44px] z-20 bg-primary cursor-pointer hover:bg-primary/85 select-none transition-colors" onClick={() => onSort('recitation')}>
          <span className="flex items-center justify-center gap-0.5 whitespace-normal text-center leading-tight">تلاوة (20)<SortIcon field="recitation" sortField={sortField} sortDirection={sortDirection} /></span>
        </th>
        <th className="border-b border-l border-primary-foreground/10 p-2 min-w-[70px] sticky top-[44px] z-20 bg-primary cursor-pointer hover:bg-primary/85 select-none transition-colors" onClick={() => onSort('memorization')}>
          <span className="flex items-center justify-center gap-0.5 whitespace-normal text-center leading-tight">حفظ (60)<SortIcon field="memorization" sortField={sortField} sortDirection={sortDirection} /></span>
        </th>
        <th className="border-b border-l border-primary-foreground/10 p-2 min-w-[70px] sticky top-[44px] z-20 bg-primary cursor-pointer hover:bg-primary/85 select-none transition-colors" onClick={() => onSort('total')}>
          <span className="flex items-center justify-center gap-0.5 whitespace-normal text-center leading-tight">مجموع<SortIcon field="total" sortField={sortField} sortDirection={sortDirection} /></span>
        </th>
      </tr>
    </thead>
  );
};
