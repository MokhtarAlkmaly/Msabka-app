import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, Printer, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  teachers: string[];
  selectedTeacher: string;
  onTeacherChange: (value: string) => void;
  nameFilter: string;
  onNameFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  gradeFilter: string;
  onGradeFilterChange: (value: string) => void;
  partsFilter: string;
  onPartsFilterChange: (value: string) => void;
  onPrintFiltered: () => void;
  hasFilters: boolean;
}

export const TableFilters = ({
  teachers,
  selectedTeacher,
  onTeacherChange,
  nameFilter,
  onNameFilterChange,
  statusFilter,
  onStatusFilterChange,
  gradeFilter,
  onGradeFilterChange,
  partsFilter,
  onPartsFilterChange,
  onPrintFiltered,
  hasFilters,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-card/90 shadow-lg shadow-primary/5 backdrop-blur print:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-3 p-4 transition-colors hover:bg-primary/5"
      >
        <div className="flex items-center gap-3 text-primary">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10">
            <Filter className="h-4 w-4" />
          </span>
          <span className="text-start">
            <span className="block font-black">تصفية البيانات</span>
            <span className="block text-xs text-muted-foreground">ابحث ورتّب الكشف بسرعة</span>
          </span>
          {hasFilters && (
            <span className="rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground">
              مفعّل
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasFilters && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onPrintFiltered();
              }}
              variant="secondary"
              size="sm"
              className="h-9 gap-1 rounded-full text-xs"
            >
              <Printer className="h-3 w-3" />
              طباعة
            </Button>
          )}
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="grid grid-cols-1 gap-3 border-t border-border/60 bg-background/45 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={selectedTeacher} onValueChange={onTeacherChange}>
            <SelectTrigger className="h-11 rounded-2xl bg-background text-sm">
              <SelectValue placeholder="المعلم/ة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المعلمين والمعلمات</SelectItem>
              {teachers.map((teacher) => (
                <SelectItem key={teacher} value={teacher}>
                  {teacher}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={nameFilter}
              onChange={(e) => onNameFilterChange(e.target.value)}
              placeholder="بحث بالاسم..."
              className="h-11 rounded-2xl pr-10 text-sm"
            />
          </div>

          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="h-11 rounded-2xl bg-background text-sm">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="inactive">منقطع</SelectItem>
            </SelectContent>
          </Select>

          <Select value={gradeFilter} onValueChange={onGradeFilterChange}>
            <SelectTrigger className="h-11 rounded-2xl bg-background text-sm">
              <SelectValue placeholder="التقدير" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل التقديرات</SelectItem>
              <SelectItem value="ممتاز">ممتاز</SelectItem>
              <SelectItem value="جيد جداً">جيد جداً</SelectItem>
              <SelectItem value="جيد">جيد</SelectItem>
              <SelectItem value="مقبول">مقبول</SelectItem>
              <SelectItem value="ضعيف">ضعيف</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="number"
            value={partsFilter}
            onChange={(e) => onPartsFilterChange(e.target.value)}
            placeholder="الحد الأدنى للحفظ"
            min="0"
            className="h-11 rounded-2xl bg-background text-sm"
          />
        </div>
      )}
    </div>
  );
};
