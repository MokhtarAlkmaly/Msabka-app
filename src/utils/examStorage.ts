/**
 * بنك الأسئلة — تخزين **محلي أولاً** (المرحلة 5).
 *
 * كان التبويبان (`ExtraBankTab` و`ExamPapersTab`) يستعلمان Supabase مباشرة:
 * بلا إنترنت لا يظهر البنك ولا يُحفظ شيء. الآن بنفس نمط بقية الكيانات:
 *
 *  1) القراءة من SQLite دائماً.
 *  2) تحديث **محصور بالعام المطلوب فقط** من السحابة عند الاتصال، مع حماية
 *     الصفوف ذات التعديل المعلّق.
 *  3) الكتابة محلية + `markDirty` + `queueCloudSync`.
 *  4) فشل السحابة تحذير لا شاشة خطأ.
 *
 * مفتاح الجدول UUID: المعرّف يُولَّد على الجهاز ويبقى نفسه عند الرفع، فلا
 * مطابقة ولا إعادة ترقيم (على عكس الطلاب ذوي المعرّفات المؤقتة).
 */

import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages } from "@/lib/cloud-pages";
import {
  createExamQuestion,
  examQuestionSchema,
  fromExamQuestionRow,
  sortExamQuestions,
  toExamQuestionRow,
  type ExamQuestion,
  type ExamQuestionInput,
  type ExamQuestionRow,
} from "@/lib/exam-questions";
import {
  deleteCachedExamQuestion,
  getCachedExamQuestion,
  getCachedExamQuestionsForYear,
  putCachedExamQuestion,
  replaceScopedRows,
} from "./localDB";
import {
  assertWritableOwner,
  canRefreshFromCloud,
  isViewingOtherUser,
  markLocalChange,
  pendingIdsFor,
  resolveOwnerId,
} from "./pendingIds";

const TABLE = "exam_questions";

/** تنزيل كل أسئلة عام واحد من السحابة (بلا اقتطاع عند 1000 صف). */
const fetchYearFromCloud = async (
  ownerId: string,
  year: string,
  signal?: AbortSignal,
): Promise<ExamQuestionRow[]> => {
  const rows = await fetchAllPages<ExamQuestion>(async (from, to) => {
    let query = supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", ownerId)
      .eq("year", year)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => fromExamQuestionRow(row as ExamQuestionRow));
  });
  return rows.map(toExamQuestionRow);
};

/**
 * كل أسئلة عام واحد: محلية فوراً، ثم تحديث محصور من السحابة إن توفّر الاتصال.
 */
export const loadExamQuestions = async (
  year: string,
  signal?: AbortSignal,
): Promise<ExamQuestion[]> => {
  const ownerId = await resolveOwnerId();

  // وضع الاطلاع: قراءة سحابية مباشرة (بنك الأسئلة ليس على جهازنا).
  if (isViewingOtherUser()) {
    return sortExamQuestions(
      (await fetchYearFromCloud(ownerId, year, signal)).map(fromExamQuestionRow),
    );
  }

  let rows = await getCachedExamQuestionsForYear(ownerId, year);

  if (canRefreshFromCloud(ownerId)) {
    try {
      const cloudRows = await fetchYearFromCloud(ownerId, year, signal);
      const protectedIds = await pendingIdsFor("exam_question");
      await replaceScopedRows<ExamQuestionRow>(
        TABLE,
        { user_id: ownerId, year },
        cloudRows,
        protectedIds,
      );
      rows = await getCachedExamQuestionsForYear(ownerId, year);
    } catch (err) {
      console.warn("examStorage: تعذّر تحديث بنك الأسئلة من السحابة", err);
    }
  }

  return sortExamQuestions(rows.map(fromExamQuestionRow));
};

/** حفظ سؤال (إضافة أو تعديل) — محلي أولاً ثم الرفع في الخلفية. */
export const saveExamQuestion = async (
  input: ExamQuestionInput,
  id?: string,
): Promise<ExamQuestion> => {
  const ownerId = await assertWritableOwner();
  const values = examQuestionSchema.parse(input);
  const questionId = id ?? undefined;
  const previous = questionId ? await getCachedExamQuestion(questionId) : undefined;
  const created = createExamQuestion(values, ownerId, questionId);
  const record: ExamQuestion = {
    ...created,
    created_at: previous?.created_at ?? created.created_at,
  };
  await putCachedExamQuestion(toExamQuestionRow(record));
  await markLocalChange("exam_question", "upsert", { id: record.id });
  return record;
};

/** حفظ دفعة من الأسئلة (نماذج الاختبار المولَّدة) دفعة محلية واحدة. */
export const saveExamQuestions = async (
  inputs: ExamQuestionInput[],
): Promise<{ saved: ExamQuestion[]; skipped: number }> => {
  const ownerId = await assertWritableOwner();
  const existing = await getCachedExamQuestionsForYear(ownerId, inputs[0]?.year ?? "");
  const seen = new Set(existing.map((row) => row.question.trim().toLocaleLowerCase("ar")));
  const saved: ExamQuestion[] = [];
  let skipped = 0;
  for (const input of inputs) {
    const key = input.question.trim().toLocaleLowerCase("ar");
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    const record = createExamQuestion(input, ownerId);
    await putCachedExamQuestion(toExamQuestionRow(record));
    await markLocalChange("exam_question", "upsert", { id: record.id });
    saved.push(record);
  }
  return { saved, skipped };
};

/** حذف سؤال — محلياً، والحذف السحابي يمرّ بالطابور. */
export const deleteExamQuestion = async (id: string): Promise<{ id: string }> => {
  await assertWritableOwner();
  await deleteCachedExamQuestion(id);
  await markLocalChange("exam_question", "delete", { id });
  return { id };
};

export { examQuestionErrorMessage } from "@/lib/exam-questions";
