// Strict specialty matching for branch materials.
//
// There is no teacher↔material table and no specialty vocabulary either:
// `teachers.specialty` is free text ("Business & Startup Management", "ERP
// Consulting", "Warehouse & Logistics") and branch materials are named by the
// operator. A teacher therefore qualifies for a material only when their
// specialty *strictly* names the same discipline — the normalized material name
// must appear in the normalized specialty as a whole phrase (or be the whole
// specialty):
//
//   Business Startup      → "Business & Startup Management"
//   ERP Consulting        → "ERP Consulting"
//   Warehouse & Logistics → "Warehouse & Logistics"
//
// There are no keyword families any more: "Management, Finance & Logistics" can
// no longer pull an accountant onto a Warehouse & Logistics module. Text is
// folded with `normalizeSubjectText()` from planningSubjects.ts so accents,
// casing and punctuation never matter ("Réseaux & Cybersécurité" and
// "RESEAUX ET CYBERSECURITE" normalize the same way).
//
// The single controlled exception is the name of a language, which is the same
// discipline in both working languages ("Anglais" ↔ "English"), so a language
// material also matches the other spelling.

import { normalizeSubjectText } from "./planningSubjects";

/** The same discipline under the center's two working languages. */
const DISCIPLINE_EQUIVALENTS: string[][] = [
  ["anglais", "english"],
  ["francais", "french"],
  ["arabe", "arabic"],
  ["espagnol", "spanish"],
  ["allemand", "german"],
  ["italien", "italian"],
];

/**
 * Whole-word phrase test: "ERP" matches "ERP Consulting" but not "Enterprise
 * Reporting", and "IT" never matches inside "digital".
 */
function containsPhrase(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  return ` ${haystack} `.includes(` ${needle} `);
}

/** The material's normalized name plus any same-discipline spellings. */
function materialVariants(materialName: string): string[] {
  const material = normalizeSubjectText(materialName);
  if (!material) return [];
  const variants = new Set<string>([material]);
  for (const group of DISCIPLINE_EQUIVALENTS) {
    if (!group.some((entry) => containsPhrase(material, entry))) continue;
    for (const entry of group) variants.add(entry);
  }
  return Array.from(variants);
}

/**
 * True when the teacher's free-text specialty names this material's discipline.
 * Pure text on both sides — no roster lookups and no family aliases.
 */
export function teacherMatchesMaterial(
  materialName: string | null | undefined,
  specialty: string | null | undefined,
): boolean {
  const specialtyText = normalizeSubjectText(specialty);
  if (!specialtyText) return false;
  return materialVariants(materialName ?? "").some((variant) =>
    containsPhrase(specialtyText, variant),
  );
}

export interface MaterialTeacherMatch<T> {
  /**
   * Teachers whose specialty strictly names this discipline, in roster order.
   * Empty when nobody matches (the caller shows "No specialist" rather than
   * offering an unrelated teacher) or when the material has no name yet.
   */
  teachers: T[];
  /** The material name used in UI copy; "" when no name was given. */
  scopeLabel: string;
}

/**
 * The only teachers allowed on one material. A single match is locked in by the
 * caller; two or more render a dropdown of just these teachers.
 */
export function matchingTeachersForMaterial<
  T extends { specialty?: string | null },
>(
  materialName: string | null | undefined,
  teachers: readonly T[],
): MaterialTeacherMatch<T> {
  const label = (materialName ?? "").trim();
  if (!label) return { teachers: [], scopeLabel: "" };
  return {
    teachers: teachers.filter((teacher) =>
      teacherMatchesMaterial(label, teacher.specialty),
    ),
    scopeLabel: label,
  };
}
