/**
 * بديل `src/utils/localDB.ts` في اختبارات Node — قاعدة SQLite في الذاكرة.
 *
 * يحاكي **سلوك** الوحدة الحقيقية لا بنيتها:
 *  - الجداول خرائط في الذاكرة، والكتابة تمرّ بنفس تحويلات الأعمدة
 *    (`choices` مصفوفة ⇄ نصّ JSON، وختم `local_updated_at`).
 *  - `replaceScopedRows` يطبّق نفس سياسة التحديث المحصور: حذف ما اختفى من
 *    السحابة داخل النطاق، وكتابة الوارد، **وحماية الصفوف ذات التعديل المعلّق**.
 *  - `markDirty` يبني نفس مفاتيح الطابور (`community:<id>` / `exam:<id>`).
 */

const state = {
  tables: new Map(),
  pending: new Map(),
  writes: [],
};

const tableOf = (name) => {
  if (!state.tables.has(name)) state.tables.set(name, new Map());
  return state.tables.get(name);
};

const keyOf = (key) => (Array.isArray(key) ? key.join("|") : String(key));

const stamp = (row) => ({
  ...row,
  local_updated_at: row.local_updated_at ?? row.updated_at ?? new Date().toISOString(),
});

/** تحويل الكائن إلى صف مخزَّن (نفس `toRow` في الوحدة الحقيقية). */
const toStorage = (table, row) => {
  if (table !== "exam_questions") return row;
  // نفس سياسة `toRow` في الوحدة الحقيقية: النصّ يُخزَّن كما هو، وما عداه يُحوَّل.
  const choices =
    row.choices === null || row.choices === undefined
      ? null
      : typeof row.choices === "string"
        ? row.choices
        : JSON.stringify(row.choices ?? []);
  return { ...row, choices };
};

/** تحويل الصف المخزَّن إلى كائن (نفس `fromRow`). */
const fromStorage = (table, row) => {
  if (table !== "exam_questions") return { ...row };
  let choices = [];
  try {
    const parsed = JSON.parse(row.choices ?? "[]");
    if (Array.isArray(parsed)) choices = parsed;
  } catch {
    choices = [];
  }
  return { ...row, choices };
};

const matchesScope = (row, scope) =>
  Object.entries(scope).every(([column, value]) => String(row[column]) === String(value));

// ========== أدوات التحكم في البديل (للاختبارات فقط) ==========

export const __db = state;

export const __resetDb = () => {
  state.tables.clear();
  state.pending.clear();
  state.writes.length = 0;
};

/** يضع صفوفاً جاهزة في جدول (محاكاة بيانات محلية موجودة مسبقاً). */
export const __seed = (table, rows) => {
  const target = tableOf(table);
  for (const row of rows) target.set(String(row.id), toStorage(table, stamp(row)));
};

// ========== الواجهة المستعملة من طبقات التخزين ==========

export const putItem = async (table, item) => {
  state.writes.push({ op: "put", table, id: String(item.id) });
  tableOf(table).set(String(item.id), toStorage(table, stamp(item)));
};

export const getItem = async (table, key) => {
  const row = tableOf(table).get(keyOf(key));
  return row ? fromStorage(table, row) : undefined;
};

export const getAllItems = async (table) =>
  [...tableOf(table).values()].map((row) => fromStorage(table, row));

export const deleteItem = async (table, key) => {
  state.writes.push({ op: "delete", table, id: keyOf(key) });
  tableOf(table).delete(keyOf(key));
};

export const getPendingChanges = async () =>
  [...state.pending.values()].map((change) => ({ ...change }));

export const clearPending = async (key) => {
  state.pending.delete(key);
};

export const markDirty = async (entity, op, ref) => {
  const prefixes = { community_record: "community", exam_question: "exam" };
  const key = `${prefixes[entity] ?? entity}:${ref?.id}`;
  state.pending.set(key, { key, entity, op, ref: { ...ref }, ts: Date.now() });
};

/**
 * تحديث محصور بنطاق واحد (مالك + قسم/عام) مع حماية التعديلات المعلّقة.
 * @returns نفس شكل الوحدة الحقيقية `{ written, deleted, kept }`.
 */
export const replaceScopedRows = async (table, scope, rows, protectedIds = new Set()) => {
  const target = tableOf(table);
  const incoming = rows.filter((row) => !protectedIds.has(String(row.id)));

  let deleted = 0;
  for (const [id, row] of [...target.entries()]) {
    if (!matchesScope(row, scope)) continue;
    if (protectedIds.has(String(id))) continue;
    if (incoming.some((candidate) => String(candidate.id) === String(id))) continue;
    target.delete(id);
    deleted++;
  }

  for (const row of incoming) {
    target.set(String(row.id), toStorage(table, stamp(row)));
  }

  const kept = [...target.values()].filter(
    (row) => matchesScope(row, scope) && protectedIds.has(String(row.id)),
  ).length;

  return { written: incoming.length, deleted, kept };
};

// ========== سجل المجتمع ==========

export const cacheCommunityRecords = async (rows) => {
  tableOf("community_records").clear();
  for (const row of rows) await putItem("community_records", row);
};

export const getCachedCommunityRecords = async () => getAllItems("community_records");

export const getCachedCommunityRecord = (id) => getItem("community_records", id);

export const putCachedCommunityRecord = (row) => putItem("community_records", row);

export const deleteCachedCommunityRecord = (id) => deleteItem("community_records", id);

export const getCachedCommunityRecordsForDepartment = async (userId, department) =>
  [...tableOf("community_records").values()]
    .filter((row) => row.user_id === userId && row.department === department)
    .map((row) => fromStorage("community_records", row));

// ========== بنك الأسئلة ==========

export const cacheExamQuestions = async (rows) => {
  tableOf("exam_questions").clear();
  for (const row of rows) await putItem("exam_questions", row);
};

export const getCachedExamQuestions = async () => getAllItems("exam_questions");

export const getCachedExamQuestion = (id) => getItem("exam_questions", id);

export const putCachedExamQuestion = (row) => putItem("exam_questions", row);

export const deleteCachedExamQuestion = (id) => deleteItem("exam_questions", id);

export const getCachedExamQuestionsForYear = async (userId, year) =>
  [...tableOf("exam_questions").values()]
    .filter((row) => row.user_id === userId && row.year === year)
    .map((row) => fromStorage("exam_questions", row));
