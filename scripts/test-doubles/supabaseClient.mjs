/**
 * بديل `src/integrations/supabase/client` في اختبارات Node.
 *
 * عميل وهمي يسجّل كل استدعاء (الجدول، المرشّحات، النطاق، نوع العملية) ويقرأ
 * من صفوف مزروعة في الذاكرة — فيمكن للاختبار أن يتحقق من:
 *  - أن التنزيل يمرّ بالصفحات (`range`) ولا يقتطع عند 1000 صف.
 *  - أن القراءة محصورة بالنطاق المطلوب (`eq("user_id")` و`eq("year")`).
 *  - أن «وضع الجهاز» وانقطاع الاتصال لا يلمسان السحابة إطلاقاً (صفر استدعاءات).
 */

const state = {
  rows: new Map(),
  calls: [],
  session: { user: { id: "owner-a" } },
  failWith: null,
};

export const __cloud = state;

export const __resetCloud = () => {
  state.rows.clear();
  state.calls.length = 0;
  state.session = { user: { id: "owner-a" } };
  state.failWith = null;
};

/** يزرع صفوفاً في جدول سحابي وهمي. */
export const __seedCloud = (table, rows) => {
  state.rows.set(
    table,
    rows.map((row) => ({ ...row })),
  );
};

/** يجبر كل العمليات على الفشل بهذا الخطأ (محاكاة جدول غير مطبَّق). */
export const __failCloudWith = (error) => {
  state.failWith = error;
};

const buildResponse = (call) => {
  if (state.failWith) return { data: null, error: state.failWith };
  const rows = state.rows.get(call.table) ?? [];
  const filtered = rows.filter((row) =>
    call.filters.every(([column, value]) => String(row[column]) === String(value)),
  );
  if (call.op === "select") {
    const [from, to] = call.range ?? [0, filtered.length - 1];
    const page = filtered.slice(from, to + 1);
    if (call.single) return { data: page[0] ?? null, error: null };
    return { data: page, error: null };
  }
  if (call.op === "delete") {
    return { data: filtered.map((row) => ({ id: row.id })), error: null };
  }
  return { data: call.insert ?? call.update ?? null, error: null };
};

export const supabase = {
  auth: {
    getSession: async () => ({
      data: { session: state.session },
      error: state.session ? null : { message: "no session" },
    }),
  },
  from(table) {
    const call = { table, filters: [], orders: [], op: "select", range: null };
    state.calls.push(call);
    const builder = {
      select() {
        return builder;
      },
      eq(column, value) {
        call.filters.push([column, value]);
        return builder;
      },
      order(column, options) {
        call.orders.push([column, options]);
        return builder;
      },
      range(from, to) {
        call.range = [from, to];
        return builder;
      },
      abortSignal(signal) {
        call.signal = signal;
        return builder;
      },
      insert(values) {
        call.op = "insert";
        call.insert = values;
        return builder;
      },
      update(values) {
        call.op = "update";
        call.update = values;
        return builder;
      },
      delete() {
        call.op = "delete";
        return builder;
      },
      single() {
        call.single = true;
        return builder;
      },
      then(onfulfilled, onrejected) {
        return Promise.resolve(buildResponse(call)).then(onfulfilled, onrejected);
      },
    };
    return builder;
  },
};
