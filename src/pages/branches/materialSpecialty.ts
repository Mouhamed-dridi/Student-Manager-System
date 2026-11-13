// Which teachers a branch material should suggest.
//
// There is no teacher↔material table (and no specialty vocabulary either):
// `teachers.specialty` is free text ("Cybersecurity & Networking", "Arabic
// Language & Literature", "ERP Consulting"), while branch materials are named
// by the operator ("Réseaux & Cybersécurité", "Anglais", "Warehouse &
// Logistics"). Both sides are therefore matched through keyword families
// instead of equality:
//
//   languages  → Anglais / Français / Arabe / Communication …
//   it         → Réseaux & Cybersécurité / Développement / Web / Data …
//   management → Accounting / ERP Consulting / Warehouse & Logistics …
//
// The match is a hard filter: a material only accepts teachers whose specialty
// falls in its family, so Elyes Kefi (Warehouse & Logistics) can no longer be
// assigned to Anglais or Réseaux & Cybersécurité. A material whose name matches
// no family cannot be classified, so the whole roster stays available and the
// caller is told via `unmatched`.
//
// Text is folded with `normalizeSubjectText()` from planningSubjects.ts so
// accents and punctuation never matter: "Réseaux & Cybersécurité" and
// "RESEAUX ET CYBERSECURITE" produce the same normalized string.

import { normalizeSubjectText } from "./planningSubjects";

export type MaterialCategory = "languages" | "it" | "management";

/** Human label shown as the suggested group heading. */
export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  languages: "Languages & Communication",
  it: "IT & Computer Science",
  management: "Management, Finance & Logistics",
};

/**
 * Tested in this order, so a name that mentions two families lands on the most
 * specific one ("Business Communication" is management, not a language).
 */
const CATEGORY_ORDER: MaterialCategory[] = ["it", "management", "languages"];

/** Words that identify the family of a material name. */
const MATERIAL_ALIASES: Record<MaterialCategory, string[]> = {
  languages: [
    "langue",
    "langues",
    "language",
    "languages",
    "linguistique",
    "communication",
    "anglais",
    "english",
    "francais",
    "french",
    "arabe",
    "arabic",
    "espagnol",
    "spanish",
    "allemand",
    "german",
    "italien",
    "italian",
    "litterature",
    "literature",
    "expression",
    "redaction",
    "traduction",
    "translation",
  ],
  it: [
    "informatique",
    "computer",
    "computing",
    "reseaux",
    "reseau",
    "network",
    "networking",
    "cyber",
    "cybersecurite",
    "cybersecurity",
    "securite",
    "security",
    "developpement",
    "development",
    "web",
    "logiciel",
    "software",
    "programmation",
    "programming",
    "algorithmique",
    "algorithm",
    "database",
    "donnees",
    "data",
    "linux",
    "unix",
    "systeme",
    "systems",
    "cloud",
    "devops",
    "react",
    "node",
    "java",
    "python",
    "sql",
    "fullstack",
    "frontend",
    "backend",
    "mobile",
    "application",
    "it",
  ],
  management: [
    "gestion",
    "management",
    "manager",
    "comptabilite",
    "accounting",
    "comptable",
    "finance",
    "financier",
    "financial",
    "erp",
    "logistique",
    "logistics",
    "warehouse",
    "entrepot",
    "approvisionnement",
    "supply",
    "commerce",
    "business",
    "marketing",
    "vente",
    "sales",
    "retail",
    "qualite",
    "quality",
    "audit",
    "controle",
    "ressources humaines",
    "human resources",
    "administration",
    "secretariat",
    "startup",
    "entrepreneuriat",
    "entrepreneurship",
    "economie",
    "economy",
    "droit",
    "law",
    "immobilier",
    "real estate",
  ],
};

/** Words that identify a teacher's family inside their free-text specialty. */
const SPECIALTY_ALIASES: Record<MaterialCategory, string[]> = {
  languages: [
    "langue",
    "langues",
    "language",
    "languages",
    "linguistique",
    "communication",
    "anglais",
    "english",
    "francais",
    "french",
    "arabe",
    "arabic",
    "espagnol",
    "spanish",
    "allemand",
    "german",
    "italien",
    "italian",
    "litterature",
    "literature",
    "traduction",
    "translation",
    "lettres",
    "philologie",
  ],
  it: [
    "informatique",
    "computer",
    "computing",
    "reseaux",
    "reseau",
    "network",
    "networking",
    "cyber",
    "cybersecurite",
    "cybersecurity",
    "securite",
    "security",
    "developpement",
    "development",
    "web",
    "logiciel",
    "software",
    "programmation",
    "programming",
    "algorithmique",
    "algorithm",
    "database",
    "donnees",
    "data",
    "linux",
    "unix",
    "systeme",
    "systems",
    "cloud",
    "devops",
    "react",
    "node",
    "java",
    "python",
    "sql",
    "fullstack",
    "frontend",
    "backend",
    "mobile",
    "application",
    "it",
  ],
  management: [
    "gestion",
    "management",
    "manager",
    "comptabilite",
    "accounting",
    "comptable",
    "finance",
    "financier",
    "financial",
    "erp",
    "logistique",
    "logistics",
    "warehouse",
    "entrepot",
    "approvisionnement",
    "supply",
    "commerce",
    "business",
    "marketing",
    "vente",
    "sales",
    "retail",
    "qualite",
    "quality",
    "audit",
    "controle",
    "ressources humaines",
    "human resources",
    "administration",
    "secretariat",
    "startup",
    "entrepreneuriat",
    "entrepreneurship",
    "economie",
    "economy",
    "droit",
    "law",
    "immobilier",
    "real estate",
  ],
};

/**
 * True when `text` mentions one of `aliases`.
 *
 * Short aliases ("web", "erp", "it") only count as whole words — otherwise "IT"
 * would match inside "digital" and "web" inside "webinaire". Longer ones match
 * as prefixes so "developpement" still finds "developpement web".
 */
function mentions(normalized: string, aliases: string[]): boolean {
  if (!normalized) return false;
  return aliases.some((alias) => {
    const needle = normalizeSubjectText(alias);
    if (!needle) return false;
    if (needle.length >= 4) return normalized.includes(needle);
    return new RegExp(`(^| )${needle}( |$)`).test(normalized);
  });
}

/** The family of a material name, or null when no keyword matches. */
export function materialCategory(
  name: string | null | undefined,
): MaterialCategory | null {
  const normalized = normalizeSubjectText(name);
  if (!normalized) return null;
  for (const category of CATEGORY_ORDER) {
    if (mentions(normalized, MATERIAL_ALIASES[category])) return category;
  }
  return null;
}

/** Every family a teacher's free-text specialty belongs to. */
export function teacherCategories(
  specialty: string | null | undefined,
): MaterialCategory[] {
  const normalized = normalizeSubjectText(specialty);
  if (!normalized) return [];
  return CATEGORY_ORDER.filter((category) =>
    mentions(normalized, SPECIALTY_ALIASES[category]),
  );
}

// Within the languages family, a material can name one language explicitly
// ("Anglais" vs "Français" vs "Arabe"). Matching the whole family there would
// let a French specialist teach Arabic, so the specific language narrows the
// shortlist; a generic name ("Langues", "Communication") keeps the family.
export type LanguageKey =
  | "english"
  | "french"
  | "arabic"
  | "spanish"
  | "german"
  | "italian";

const LANGUAGE_ORDER: LanguageKey[] = [
  "english",
  "french",
  "arabic",
  "spanish",
  "german",
  "italian",
];

const MATERIAL_LANGUAGE_ALIASES: Record<LanguageKey, string[]> = {
  english: ["anglais", "english"],
  french: ["francais", "french"],
  arabic: ["arabe", "arabic"],
  spanish: ["espagnol", "spanish"],
  german: ["allemand", "german"],
  italian: ["italien", "italian"],
};

const SPECIALTY_LANGUAGE_ALIASES: Record<LanguageKey, string[]> = {
  english: ["anglais", "english"],
  french: ["francais", "french"],
  arabic: ["arabe", "arabic"],
  spanish: ["espagnol", "spanish"],
  german: ["allemand", "german"],
  italian: ["italien", "italian"],
};

const LANGUAGE_LABELS: Record<LanguageKey, string> = {
  english: "English",
  french: "French",
  arabic: "Arabic",
  spanish: "Spanish",
  german: "German",
  italian: "Italian",
};

function firstLanguage(
  normalized: string,
  aliases: Record<LanguageKey, string[]>,
): LanguageKey | null {
  if (!normalized) return null;
  for (const language of LANGUAGE_ORDER) {
    if (mentions(normalized, aliases[language])) return language;
  }
  return null;
}

/** The language a material name names explicitly, or null for a general one. */
export function materialLanguage(
  name: string | null | undefined,
): LanguageKey | null {
  return firstLanguage(normalizeSubjectText(name), MATERIAL_LANGUAGE_ALIASES);
}

/** The language a teacher's specialty names explicitly, if any. */
export function teacherLanguage(
  specialty: string | null | undefined,
): LanguageKey | null {
  return firstLanguage(
    normalizeSubjectText(specialty),
    SPECIALTY_LANGUAGE_ALIASES,
  );
}

export function teacherMatchesCategory(
  specialty: string | null | undefined,
  category: MaterialCategory | null,
): boolean {
  return category !== null && teacherCategories(specialty).includes(category);
}

export interface MaterialTeacherMatch<T> {
  /** Family of the material name, or null when no keyword matches. */
  category: MaterialCategory | null;
  /**
   * The only teachers allowed on this material: its family's specialists. When
   * the material name matches no family there is nothing to filter on, so the
   * whole roster is returned and `unmatched` is true.
   */
  teachers: T[];
  /** True when the material name matched no family (roster unfiltered). */
  unmatched: boolean;
  /**
   * Human label of the exact scope: the language for "Anglais", otherwise the
   * family ("IT & Computer Science"). Empty when `unmatched`.
   */
  scopeLabel: string;
}

/**
 * Strict specialty filter for one material: family specialists only. Language
 * materials narrow further to the named language (Anglais → English teachers),
 * while a generic name ("Langues") keeps the language family. Returns an empty
 * `teachers` list when the material is recognised but nobody in the roster
 * belongs to that family — the caller shows "no specialist" instead of falling
 * back to an unrelated teacher.
 */
export function matchingTeachersForMaterial<
  T extends { specialty?: string | null },
>(
  materialName: string | null | undefined,
  teachers: readonly T[],
): MaterialTeacherMatch<T> {
  const category = materialCategory(materialName);
  if (!category) {
    return {
      category: null,
      teachers: [...teachers],
      unmatched: true,
      scopeLabel: "",
    };
  }
  let specialists = teachers.filter((teacher) =>
    teacherMatchesCategory(teacher.specialty, category),
  );
  const language = category === "languages" ? materialLanguage(materialName) : null;
  if (language) {
    specialists = specialists.filter(
      (teacher) => teacherLanguage(teacher.specialty) === language,
    );
  }
  return {
    category,
    teachers: specialists,
    unmatched: false,
    scopeLabel: language
      ? `${LANGUAGE_LABELS[language]} language`
      : MATERIAL_CATEGORY_LABELS[category],
  };
}
