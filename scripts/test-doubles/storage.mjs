/**
 * بديل `src/utils/storage.ts` في اختبارات Node.
 *
 * طبقات التخزين المحلية تستورد منه `queueCloudSync` فقط (جدولة الرفع)، لكن
 * استيراد الوحدة الحقيقية يجرّ كل التطبيق (الطلاب، المتابعة، الوسائط…) ويحتاج
 * عميل Supabase حقيقياً. البديل يسجّل عدد مرات الجدولة لا أكثر.
 */

const state = { queued: 0 };

export const __sync = state;

export const __resetSync = () => {
  state.queued = 0;
};

export const queueCloudSync = () => {
  state.queued += 1;
};

export const isOnline = () => true;
