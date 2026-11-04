// Shared helpers for the operator Planification section: the qualification
// tracks the main page is grouped into, and the rule that decides whether a
// planning row belongs to a training.
//
// `programs.code` is the source of truth ("BTS", "BTP", "CAP"); rows written
// before the planning scope migration only carry the "BTS · Réseaux et
// sécurité informatique" label, so the track and the training are both
// recovered from it as a fallback.

import type { PlanningRecord } from "@/pages/teacher-portal/planning";

/** Main-page sections, in the order the operator reads them. */
export const PROGRAM_TIERS = [
  { code: "CAP", title: "CAP Programs" },
  { code: "BTP", title: "BTP Programs" },
  { code: "BTS", title: "BTS Programs" },
] as const;

export type TierCode = (typeof PROGRAM_TIERS)[number]["code"];

export function tierCodeOf(code: string | null | undefined): TierCode | "" {
  const normalized = (code ?? "").trim().toUpperCase();
  const tier = PROGRAM_TIERS.find((option) => option.code === normalized);
  return tier ? tier.code : "";
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

/**
 * A session belongs to a training when its `training_id` matches, or — for
 * legacy rows that predate the column — when the stored class label
 * ("BTS · Réseaux et sécurité informatique") names that training.
 */
export function sessionInTraining(
  entry: PlanningRecord,
  training: { id: string; name: string },
): boolean {
  if (entry.trainingId) return entry.trainingId === training.id;
  const label = normalize(entry.className);
  const name = normalize(training.name);
  return name !== "" && label.includes(name);
}

/** The rows both the Planification and Branches pages read to place teachers. */
export interface TrainingTeacherSources {
  planning: PlanningRecord[];
  courses: { trainingId?: string; teacherId: string }[];
  teachers: { id: string; training?: string }[];
}

/**
 * Teachers attached to a training. Three sources, so a legacy database is not
 * shown as unstaffed: the live schedule, the course catalog scoped to that
 * training, and — for rows written before planning carried the scope columns —
 * the teacher's own free-text `training`.
 */
export function teacherIdsForTraining(
  training: { id: string; name: string },
  sources: TrainingTeacherSources,
): string[] {
  const ids = new Set<string>();
  for (const entry of sources.planning) {
    if (entry.teacherId && sessionInTraining(entry, training)) {
      ids.add(entry.teacherId);
    }
  }
  for (const course of sources.courses) {
    if (course.trainingId === training.id && course.teacherId) {
      ids.add(course.teacherId);
    }
  }
  const name = normalize(training.name);
  for (const teacher of sources.teachers) {
    if (name && normalize(teacher.training) === name) {
      ids.add(teacher.id);
    }
  }
  return [...ids];
}
