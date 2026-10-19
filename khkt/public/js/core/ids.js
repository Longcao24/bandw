// Id formats shared by the browser, the validator and the Pages Function. Pure module.
export const UNIT_RE = /^u\d{2}$/;
export const LESSON_RE = /^l\d{1,2}$/;
export const LESSON_KEY_RE = /^u\d{2}\.l\d{1,2}$/;
export const EXERCISE_RE = /^u\d{2}\.l\d{1,2}\.q\d{1,2}$/;
export const DEFENSE_RE = /^u\d{2}\.d\.q\d{1,2}$/;
/** Open judge questions of the exam bank (content/exam/bank.js `open`): 'x.d.q01'. */
export const BANK_OPEN_RE = /^x\.d\.q\d{2,3}$/;
export const VIDEO_RE = /^v-[a-z0-9-]{2,40}$/;
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isExerciseId = (id) => typeof id === 'string' && (EXERCISE_RE.test(id) || DEFENSE_RE.test(id));
/** Any defense (judge) question id: lesson flashcard, unit.defense card or exam-bank open question. */
export const isDefenseQuestionId = (id) => isExerciseId(id) || (typeof id === 'string' && BANK_OPEN_RE.test(id));
export const isLessonKey = (k) => typeof k === 'string' && LESSON_KEY_RE.test(k);
export const lessonKey = (unitId, lessonId) => `${unitId}.${lessonId}`;
export function parseLessonKey(key) {
  const [u, l] = String(key).split('.');
  return { u, l };
}
/** Exercise id prefix: 'u03.l2.q4' → 'u03.l2'; defense 'u03.d.q1' → 'u03.d'. */
export const exercisePrefix = (id) => String(id).split('.').slice(0, 2).join('.');
