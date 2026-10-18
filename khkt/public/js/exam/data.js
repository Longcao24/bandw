// Loads the exam bank once and builds the id → question index (course + bank). Browser helper.
import { indexQuestions } from './generate.js';

let cache = null;
export async function examData(course) {
  if (cache && cache.course === course) return cache;
  const mod = await import('../../content/exam/bank.js');
  const bank = mod.default;
  cache = { course, bank, followUps: mod.FOLLOW_UPS || [], genericFollowUp: mod.GENERIC_FOLLOW_UP || null, index: indexQuestions(course, bank) };
  return cache;
}

export function unitInfo(course, unitId) {
  const i = course.units.findIndex((u) => u.id === unitId);
  const u = course.units[i];
  return u ? { unit: u, n: i + 1, short: `Ch. ${i + 1}`, label: `Chương ${i + 1}`, title: u.title, icon: u.icon } : { unit: null, n: 0, short: unitId, label: unitId, title: unitId, icon: '📘' };
}

export function lessonInfo(course, unitId, lessonId) {
  const u = course.units.find((x) => x.id === unitId);
  const l = u && u.lessons.find((x) => x.id === lessonId);
  return l ? { href: `#/unit/${u.id}/lesson/${l.id}`, title: l.title } : (u ? { href: `#/unit/${u.id}`, title: u.title } : null);
}
