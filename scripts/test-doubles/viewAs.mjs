/**
 * بديل `src/utils/viewAs.ts` (وضع الاطلاع) في اختبارات Node.
 *
 * الافتراضي: لا اطّلاع (`null`) — أي أن المالك هو صاحب الجلسة. يبدّل الاختبار
 * الهدف عبر `__setViewAs` ليتحقق أن الكتابة مرفوضة والقراءة سحابية.
 */

const state = { target: null };

export const __viewAs = state;

export const __setViewAs = (target) => {
  state.target = target;
};

export const getViewAs = () => state.target;

export const getViewAsId = () => state.target?.id ?? null;

export const isViewingOtherUser = () => getViewAsId() !== null;

export const setViewAs = (target) => {
  state.target = target;
};

export const subscribeViewAs = () => () => undefined;
