import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, RefreshCw, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CommunityRecordForm, communitySelectClass } from "./CommunityRecordForm";
import {
  beneficiaryTypes,
  currencies,
  recordStatuses,
  filterCommunityRecords,
  summarizeCompletedServices,
  getDepartmentPrograms,
  type CommunityRecord,
  type CommunityRecordInput,
} from "@/lib/community-records";
import type { CommunityDepartment } from "@/lib/center-programs";
import {
  communityErrorMessage,
  loadCommunityRecords,
  saveCommunityRecord,
  deleteCommunityRecord,
} from "@/utils/communityStorage";

type RegistryProps = {
  department: CommunityDepartment;
  programFilter: string;
  onProgramFilter: (program: string) => void;
};

export function CommunityRegistry(props: RegistryProps) {
  const { user, viewAs } = useAuth();
  if (!user) return null;
  // Account/department changes discard open forms and in-memory table state.
  return (
    <RegistryContent
      key={`${user.id}:${viewAs?.id ?? "self"}:${props.department}`}
      {...props}
      userId={user.id}
      ownerId={viewAs?.id ?? user.id}
      readOnly={Boolean(viewAs)}
    />
  );
}

function RegistryContent({
  department,
  programFilter,
  onProgramFilter,
  userId,
  ownerId,
  readOnly,
}: RegistryProps & { userId: string; ownerId: string; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ["community-records", userId, ownerId, department];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => loadCommunityRecords(department, signal),
    retry: false,
    gcTime: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editor, setEditor] = useState<{ record: CommunityRecord | null; program: string } | null>(
    null,
  );
  const [toDelete, setToDelete] = useState<CommunityRecord | null>(null);
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const programs = getDepartmentPrograms(department);
  const records = query.data ?? [];
  const filtered = filterCommunityRecords(records, search, programFilter, statusFilter);
  const summary = summarizeCompletedServices(filtered);
  const getProgramName = (id: string) => programs.find((program) => program.id === id)?.name ?? id;
  const save = useMutation({
    mutationFn: ({ input, id }: { input: CommunityRecordInput; id?: string }) =>
      saveCommunityRecord(input, id, userId),
    onSuccess: (record) => {
      queryClient.setQueryData<CommunityRecord[]>(queryKey, (previous = []) =>
        [record, ...previous.filter((item) => item.id !== record.id)].sort(
          (a, b) => b.service_date.localeCompare(a.service_date) || a.id.localeCompare(b.id),
        ),
      );
      setEditor(null);
      toast({ title: "تم حفظ سجل المستفيد" });
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => setFormError(communityErrorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (record: CommunityRecord) => deleteCommunityRecord(record.id, department, userId),
    onSuccess: (record) => {
      queryClient.setQueryData<CommunityRecord[]>(queryKey, (previous = []) =>
        previous.filter((item) => item.id !== record.id),
      );
      setToDelete(null);
      toast({ title: "تم حذف السجل" });
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => setDeleteError(communityErrorMessage(error)),
  });
  const busy = save.isPending || remove.isPending;
  const openEditor = (record: CommunityRecord | null) => {
    setFormError("");
    setEditor({
      record,
      program: record?.program_id ?? (programFilter === "all" ? programs[0].id : programFilter),
    });
  };

  return (
    <section
      id="community-registry"
      aria-labelledby="community-registry-title"
      className="scroll-mt-4 space-y-4 rounded-2xl border bg-card p-4 shadow-sm md:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="community-registry-title" className="text-xl font-bold">
            سجل المستفيدين والبرامج
          </h2>
          <p className="mt-1 text-sm leading-7 text-muted-foreground">
            كل سجل مشاركة أو خدمة واحدة، وليس بالضرورة مستفيدًا مختلفًا. يُحفظ كل تسجيل على جهازك
            فورًا ويعمل بدون إنترنت، ثم يُرفع إلى السحابة تلقائيًا عند توفر الاتصال.
          </p>
          {readOnly && <p className="text-sm font-bold text-amber-600">وضع الاطلاع: قراءة فقط</p>}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetching || busy}
            onClick={() => void query.refetch()}
          >
            <RefreshCw className={`ml-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          {!readOnly && (
            <Button
              size="sm"
              disabled={query.isPending || query.isError || busy}
              onClick={() => openEditor(null)}
            >
              <Plus className="ml-2 h-4 w-4" />
              إضافة مستفيد
            </Button>
          )}
        </div>
      </div>
      {!query.isPending && !query.isError && (
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            ["إجمالي السجلات", records.length],
            [
              "قيد المتابعة",
              records.filter((record) => ["registered", "in_progress"].includes(record.status))
                .length,
            ],
            [
              department === "training" ? "أتموا البرنامج" : "خدمات مكتملة",
              records.filter((record) => record.status === "completed").length,
            ],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-muted/40 p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="flex items-center gap-1">
            <Search className="h-4 w-4" />
            البحث بالاسم أو الهاتف أو المجموعة أو الكافل
          </span>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث في السجلات…"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span>البرنامج</span>
          <select
            className={communitySelectClass}
            value={programFilter}
            onChange={(event) => onProgramFilter(event.target.value)}
          >
            <option value="all">جميع البرامج</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span>الحالة</span>
          <select
            className={communitySelectClass}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">جميع الحالات</option>
            {Object.entries(recordStatuses[department]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending && (
        <p role="status" className="py-8 text-center text-muted-foreground">
          جارٍ تحميل السجلات…
        </p>
      )}
      {query.isError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p>{communityErrorMessage(query.error)}</p>
          <Button
            className="mt-3"
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            إعادة المحاولة
          </Button>
        </div>
      )}
      {!query.isPending && !query.isError && (
        <>
          <p className="text-xs text-muted-foreground">
            عرض {filtered.length} من {records.length} سجل
          </p>
          {department === "care" && (
            <div className="rounded-xl bg-emerald-500/5 p-4">
              <h3 className="mb-3 text-sm font-bold">ملخص الخدمات المكتملة ضمن النتائج</h3>
              <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">سلال تم توزيعها</dt>
                  <dd className="mt-1 font-bold">{summary.baskets.toLocaleString("ar")}</dd>
                </div>
                {Object.entries(currencies).map(([currency, label]) => (
                  <div key={currency}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 font-bold">
                      {summary.amounts[currency as keyof typeof currencies].toLocaleString("ar", {
                        maximumFractionDigits: 2,
                      })}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                المبالغ بحسب العملة، دون خلط أو تحويل. لا تشمل السجلات قيد المتابعة أو الملغاة.
              </p>
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {records.length === 0
                ? "لا توجد سجلات بعد. ابدأ بإضافة مستفيد إلى أحد برامج القسم."
                : "لا توجد سجلات مطابقة للبحث والفلاتر."}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[850px] text-right text-sm">
                <caption className="sr-only">سجلات المستفيدين في القسم الحالي</caption>
                <thead className="bg-muted/50">
                  <tr>
                    {["المستفيد", "البرنامج", "التاريخ", "الحالة", "تفاصيل الخدمة", "إجراءات"].map(
                      (heading) => (
                        <th key={heading} scope="col" className="p-3 font-bold">
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((record) => (
                    <tr key={record.id} className="border-t align-top">
                      <td className="p-3">
                        <p className="font-bold">{record.beneficiary_name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {beneficiaryTypes[record.beneficiary_type]}
                        </p>
                        {record.phone && (
                          <p dir="ltr" className="mt-1 text-right text-xs">
                            {record.phone}
                          </p>
                        )}
                        {record.guardian_name && (
                          <p className="mt-1 text-xs">ولي الأمر: {record.guardian_name}</p>
                        )}
                        {record.address && (
                          <p className="mt-1 max-w-56 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                            {record.address}
                          </p>
                        )}
                      </td>
                      <td className="p-3">
                        {getProgramName(record.program_id)}
                        {record.group_name && (
                          <p className="mt-1 text-xs text-muted-foreground">{record.group_name}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap p-3">{record.service_date}</td>
                      <td className="p-3">
                        <span className="inline-block rounded-lg bg-muted px-2 py-1 text-xs">
                          {recordStatuses[department][record.status]}
                        </span>
                      </td>
                      <td className="max-w-64 p-3">
                        {record.amount !== null && (
                          <p>
                            {record.amount.toLocaleString("ar")}{" "}
                            {record.currency ? currencies[record.currency] : ""}
                          </p>
                        )}
                        {record.quantity !== null && <p>{record.quantity} سلة غذائية</p>}
                        {record.sponsor_name && (
                          <p className="mt-1 text-xs">الكافل: {record.sponsor_name}</p>
                        )}
                        {record.notes && (
                          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-6 text-muted-foreground">
                            {record.notes}
                          </p>
                        )}
                        {record.amount === null &&
                          record.quantity === null &&
                          !record.sponsor_name &&
                          !record.notes &&
                          "—"}
                      </td>
                      <td className="p-3">
                        {readOnly ? (
                          <span className="text-xs text-muted-foreground">قراءة فقط</span>
                        ) : (
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={busy}
                              aria-label={`تعديل سجل ${record.beneficiary_name}`}
                              onClick={() => openEditor(record)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={busy}
                              className="text-destructive"
                              aria-label={`حذف سجل ${record.beneficiary_name}`}
                              onClick={() => {
                                setDeleteError("");
                                setToDelete(record);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {editor && !readOnly && (
        <CommunityRecordForm
          department={department}
          record={editor.record}
          initialProgram={editor.program}
          busy={save.isPending}
          serverError={formError}
          onClose={() => setEditor(null)}
          onSave={(input) => save.mutate({ input, id: editor.record?.id })}
        />
      )}
      <Dialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setToDelete(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>حذف سجل المستفيد؟</DialogTitle>
            <DialogDescription>
              سيُحذف سجل «{toDelete?.beneficiary_name}» في برنامج «
              {toDelete ? getProgramName(toDelete.program_id) : ""}» فقط، دون حذف مشاركاته الأخرى.
              لا يمكن التراجع.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={remove.isPending} onClick={() => setToDelete(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (toDelete) remove.mutate(toDelete);
              }}
            >
              {remove.isPending ? "جارٍ الحذف…" : "حذف السجل"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
