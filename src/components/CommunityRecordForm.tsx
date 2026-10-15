import { useState, type FormEvent, type ReactNode } from "react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  beneficiaryTypes,
  currencies,
  recordStatuses,
  getDepartmentPrograms,
  isChildProgram,
  isMoneyProgram,
  isOrphanProgram,
  communityRecordSchema,
  type CommunityRecord,
  type CommunityRecordInput,
} from "@/lib/community-records";
import type { CommunityDepartment } from "@/lib/center-programs";

export const communitySelectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function CommunityRecordForm({
  department,
  record,
  initialProgram,
  busy,
  serverError,
  onClose,
  onSave,
}: {
  department: CommunityDepartment;
  record: CommunityRecord | null;
  initialProgram: string;
  busy: boolean;
  serverError: string;
  onClose: () => void;
  onSave: (input: CommunityRecordInput) => void;
}) {
  const programs = getDepartmentPrograms(department);
  const [form, setForm] = useState(() => {
    const program = record?.program_id ?? initialProgram;
    return {
      program_id: program,
      beneficiary_name: record?.beneficiary_name ?? "",
      beneficiary_type:
        record?.beneficiary_type ??
        (isChildProgram(program)
          ? "child"
          : isOrphanProgram(program)
            ? "orphan"
            : program === "food-baskets"
              ? "family"
              : "individual"),
      guardian_name: record?.guardian_name ?? "",
      phone: record?.phone ?? "",
      address: record?.address ?? "",
      service_date: record?.service_date ?? format(new Date(), "yyyy-MM-dd"),
      status: record?.status ?? "registered",
      group_name: record?.group_name ?? "",
      sponsor_name: record?.sponsor_name ?? "",
      amount: record?.amount?.toString() ?? "",
      currency: record?.currency ?? "YER",
      quantity: record?.quantity?.toString() ?? "1",
      notes: record?.notes ?? "",
    };
  });
  const [validationError, setValidationError] = useState("");
  const change = (key: keyof typeof form, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const money = isMoneyProgram(form.program_id);
  const baskets = form.program_id === "food-baskets";
  const orphan = isOrphanProgram(form.program_id);
  const child = isChildProgram(form.program_id);
  const guardianRequired = ["child", "orphan"].includes(form.beneficiary_type);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nullable = (value: string) => value.trim() || null;
    const parsed = communityRecordSchema.safeParse({
      ...form,
      department,
      guardian_name: nullable(form.guardian_name),
      phone: nullable(form.phone),
      address: nullable(form.address),
      group_name: department === "training" ? nullable(form.group_name) : null,
      sponsor_name: orphan ? nullable(form.sponsor_name) : null,
      amount: money && form.amount !== "" ? Number(form.amount) : null,
      currency: money ? form.currency : null,
      quantity: baskets && form.quantity !== "" ? Number(form.quantity) : null,
      notes: nullable(form.notes),
    });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0].message);
      return;
    }
    setValidationError("");
    onSave(parsed.data);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        dir="rtl"
        className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader className="text-right">
          <DialogTitle>{record ? "تعديل سجل المستفيد" : "إضافة سجل مستفيد"}</DialogTitle>
          <DialogDescription>
            كل سجل يمثل مشاركة في برنامج أو خدمة بتاريخ محدد. يمكن للمستفيد الاستفادة من أكثر من
            برنامج.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            <Field label="البرنامج *">
              <select
                className={communitySelectClass}
                value={form.program_id}
                onChange={(event) => {
                  const program = event.target.value;
                  setForm((previous) => ({
                    ...previous,
                    program_id: program,
                    amount: "",
                    quantity: "1",
                    currency: "YER",
                    sponsor_name: "",
                    beneficiary_type: isChildProgram(program)
                      ? "child"
                      : isOrphanProgram(program)
                        ? "orphan"
                        : program === "food-baskets"
                          ? "family"
                          : "individual",
                  }));
                }}
              >
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="اسم المستفيد / رب الأسرة *">
              <Input
                required
                minLength={2}
                maxLength={200}
                value={form.beneficiary_name}
                onChange={(event) => change("beneficiary_name", event.target.value)}
              />
            </Field>
            <Field label="نوع المستفيد *">
              <select
                className={communitySelectClass}
                disabled={child || orphan}
                value={form.beneficiary_type}
                onChange={(event) => change("beneficiary_type", event.target.value)}
              >
                {Object.entries(beneficiaryTypes).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`ولي الأمر / الوصي${guardianRequired ? " *" : ""}`}>
              <Input
                required={guardianRequired}
                maxLength={200}
                value={form.guardian_name}
                onChange={(event) => change("guardian_name", event.target.value)}
              />
            </Field>
            <Field label="رقم التواصل">
              <Input
                type="tel"
                dir="ltr"
                maxLength={40}
                value={form.phone}
                onChange={(event) => change("phone", event.target.value)}
              />
            </Field>
            <Field label="العنوان / المنطقة">
              <Input
                maxLength={300}
                value={form.address}
                onChange={(event) => change("address", event.target.value)}
              />
            </Field>
            <Field
              label={department === "training" ? "تاريخ التسجيل *" : "تاريخ الخدمة / المتابعة *"}
            >
              <Input
                type="date"
                required
                value={form.service_date}
                onChange={(event) => change("service_date", event.target.value)}
              />
            </Field>
            <Field label="الحالة *">
              <select
                className={communitySelectClass}
                value={form.status}
                onChange={(event) => change("status", event.target.value)}
              >
                {Object.entries(recordStatuses[department]).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            {department === "training" && (
              <Field label="الدورة / المجموعة">
                <Input
                  maxLength={200}
                  placeholder="مثال: خياطة — الدفعة الأولى"
                  value={form.group_name}
                  onChange={(event) => change("group_name", event.target.value)}
                />
              </Field>
            )}
            {orphan && (
              <Field label="اسم الكافل / الجهة الداعمة">
                <Input
                  maxLength={200}
                  value={form.sponsor_name}
                  onChange={(event) => change("sponsor_name", event.target.value)}
                />
              </Field>
            )}
            {money && (
              <>
                <Field label="المبلغ لهذا السجل *">
                  <Input
                    type="number"
                    required
                    min="0.01"
                    max="999999999999.99"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) => change("amount", event.target.value)}
                  />
                </Field>
                <Field label="العملة *">
                  <select
                    className={communitySelectClass}
                    value={form.currency}
                    onChange={(event) => change("currency", event.target.value)}
                  >
                    {Object.entries(currencies).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            {baskets && (
              <Field label="عدد السلال لهذا السجل *">
                <Input
                  type="number"
                  required
                  min="1"
                  max="100000"
                  step="1"
                  value={form.quantity}
                  onChange={(event) => change("quantity", event.target.value)}
                />
              </Field>
            )}
            <div className="sm:col-span-2">
              <Field label="ملاحظات المتابعة">
                <Textarea
                  maxLength={3000}
                  rows={3}
                  value={form.notes}
                  onChange={(event) => change("notes", event.target.value)}
                />
              </Field>
            </div>
          </fieldset>
          {(validationError || serverError) && (
            <p role="alert" className="text-sm text-destructive">
              {validationError || serverError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "جارٍ الحفظ…" : "حفظ السجل"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
