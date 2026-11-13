import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * App-wide language state (English / French).
 *
 * The dictionary is keyed by the English copy itself, so a component can call
 * `t("Students")` and an untranslated string still renders readably instead of
 * showing a missing-key token. French is the only translated language; `en`
 * simply returns the key.
 *
 * State lives in a module store (like `theme.ts` and `branding.ts`) instead of a
 * React context because the active language is a singleton read by layouts,
 * pages and settings forms that do not share a provider, and because the choice
 * must be available before React's first render.
 *
 * Two localStorage copies are kept in sync, mirroring the theme:
 * - `ssm-language` is the tiny value read first at boot.
 * - `ssm-settings.language` is the existing settings cache, so the settings
 *   pages and the bootstrap never disagree. The DB row stays authoritative and
 *   `getSettings()` re-applies it on load.
 */

export type Language = "en" | "fr";

export const LANGUAGE_STORAGE_KEY = "ssm-language";
const SETTINGS_STORAGE_KEY = "ssm-settings";

/** The English→French dictionary. Keys are the English UI copy. */
const FRENCH: Record<string, string> = {
  // ---------------------------------------------------------------- navigation
  Dashboard: "Tableau de bord",
  Students: "Étudiants",
  Teachers: "Enseignants",
  Pay: "Paiements",
  Payments: "Paiements",
  History: "Historique",
  Trash: "Corbeille",
  Absence: "Absences",
  Absences: "Absences",
  "Attendance Logs": "Registres de présence",
  "Billets / Tickets": "Billets d'absence",
  "Billets d'absence": "Billets d'absence",
  Planification: "Planification",
  Planning: "Planification",
  Branches: "Filières",
  Branch: "Filière",
  Publications: "Publications",
  "News Center": "Centre d'actualités",
  Events: "Événements",
  "New Event": "Nouvel événement",
  "Event History": "Historique des événements",
  "User Management": "Gestion des utilisateurs",
  "Backup & Export": "Sauvegarde & export",
  Settings: "Paramètres",
  Announcements: "Annonces",
  Courses: "Cours",
  Exams: "Examens",
  "Create Exam": "Créer un examen",
  "Exams Table": "Tableau des examens",
  "Exam Score": "Notes d'examen",
  Class: "Classe",
  "My Class": "Ma classe",
  "My Payment": "Mes paiements",
  "My Payments": "Mes paiements",
  "My Info": "Mes informations",
  QCM: "QCM",
  "Open navigation": "Ouvrir la navigation",
  "Go back": "Retour",

  // ---------------------------------------------------------------- common UI
  "Full Name": "Nom complet",
  Name: "Nom",
  Email: "E-mail",
  Phone: "Téléphone",
  Date: "Date",
  Time: "Heure",
  Type: "Type",
  Status: "Statut",
  Details: "Détails",
  Actions: "Actions",
  Description: "Description",
  Title: "Titre",
  Message: "Message",
  Amount: "Montant",
  Program: "Programme",
  Training: "Formation",
  Specialty: "Spécialité",
  Subject: "Matière",
  Student: "Étudiant",
  Teacher: "Enseignant",
  Administration: "Administration",
  "Class / Branch": "Classe / Filière",
  Material: "Matière",
  Materials: "Matières",
  "Assigned Teacher": "Enseignant assigné",
  "Assigned teacher": "Enseignant assigné",
  "Delete": "Supprimer",
  Cancel: "Annuler",
  Close: "Fermer",
  Save: "Enregistrer",
  Edit: "Modifier",
  Remove: "Supprimer",
  Retry: "Réessayer",
  Search: "Rechercher",
  Loading: "Chargement",
  "Loading settings.": "Chargement des paramètres.",
  "Loading settings…": "Chargement des paramètres…",
  "Loading preferences…": "Chargement des préférences…",
  "Loading students.": "Chargement des étudiants.",
  "Loading teachers.": "Chargement des enseignants.",
  "Loading attendance.": "Chargement des présences.",
  "Loading billets.": "Chargement des billets.",
  "No results.": "Aucun résultat.",
  Profile: "Profil",
  "Save Changes": "Enregistrer les modifications",
  "Manage your profile and display preferences.":
    "Gérez votre profil et vos préférences d'affichage.",
  "Display preferences for this deployment.":
    "Préférences d'affichage pour ce déploiement.",
  "Your teacher record could not be found. It may have been removed by the administration.":
    "Votre fiche enseignant est introuvable. Elle a peut-être été supprimée par l'administration.",
  "Your student record could not be found. It may have been removed by the administration.":
    "Votre fiche étudiant est introuvable. Elle a peut-être été supprimée par l'administration.",
  "Uploading…": "Téléversement…",
  "Saving…": "Enregistrement…",
  "Checking…": "Vérification…",
  "Syncing…": "Synchronisation…",
  "updated": "mis à jour",
  "created": "créé",
  '"{title}" was {action}.': '« {title} » a été {action}.',
  "Student Portal": "Portail étudiant",

  // ---------------------------------------------------------------- branches
  "Every class in the center. Open one to see its materials, the teacher of each material, and its students.":
    "Toutes les classes du centre. Ouvrez une filière pour voir ses matières, l'enseignant de chaque matière et ses étudiants.",
  branch: "filière",
  branches: "filières",
  "No branches yet.": "Aucune filière pour le moment.",
  "Branches live in the branches table. If this database predates it, run supabase/branches-materials-migration.sql in the Supabase SQL Editor, then reload.":
    "Les filières sont stockées dans la table branches. Si votre base est antérieure, exécutez supabase/branches-materials-migration.sql dans l'éditeur SQL Supabase, puis rechargez.",
  "No teacher assigned": "Aucun enseignant assigné",
  material: "matière",
  materials: "matières",
  student: "étudiant",
  students: "étudiants",
  "Open class": "Ouvrir la classe",
  "Back to Branches": "Retour aux filières",
  "Branch track": "Filière",
  "Open timetable": "Ouvrir l'emploi du temps",
  "Total Materials": "Total des matières",
  "Total Teachers": "Total des enseignants",
  "Enrolled Students": "Étudiants inscrits",
  "Materials & assigned teachers": "Matières & enseignants assignés",
  "One teacher per material - that is how one class ends up staffed by several teachers. Only teachers whose specialty matches the material are listed; when there is a single one, they are locked in place.":
    "Un enseignant par matière : c'est ainsi qu'une classe réunit plusieurs enseignants. Seuls les enseignants dont la spécialité correspond à la matière sont proposés ; s'il n'y en a qu'un, il est verrouillé.",
  "Add Material": "Ajouter une matière",
  "No materials yet.": "Aucune matière pour le moment.",
  "Add the first module to this branch and assign its teacher.":
    "Ajoutez le premier module à cette filière et assignez son enseignant.",
  Unassigned: "Non assigné",
  "No specialist": "Aucun spécialiste",
  "Add material": "Ajouter une matière",
  "Material name": "Nom de la matière",
  "Enrolled students": "Étudiants inscrits",
  "No students enrolled yet.": "Aucun étudiant inscrit pour le moment.",
  "Students appear here when their training matches this branch.":
    "Les étudiants apparaissent ici lorsque leur formation correspond à cette filière.",
  "View profile": "Voir le profil",
  "the teacher list follows the material's specialty family, and a single specialist is locked in automatically.":
    "la liste des enseignants suit la famille de spécialité de la matière, et un spécialiste unique est verrouillé automatiquement.",

  // ---------------------------------------------------------------- attendance
  "Add Absence": "Ajouter une absence",
  "Import Excel": "Importer Excel",
  "Export Excel": "Exporter Excel",
  "Attendance record moved to the Trash.":
    "Enregistrement de présence déplacé vers la corbeille.",
  "Every absence ticket generated from the attendance log.":
    "Tous les billets d'absence générés depuis le registre de présence.",
  "Search by student, class, subject, teacher or code...":
    "Rechercher par étudiant, classe, matière, enseignant ou code…",
  "Search by name or class...": "Rechercher par nom ou classe…",
  "No billet matches your search.": "Aucun billet ne correspond à votre recherche.",
  "No billet has been generated yet.": "Aucun billet n'a encore été généré.",
  "Open Attendance Logs": "Ouvrir les registres de présence",
  "Verification Code": "Code de vérification",
  "Absence Date": "Date d'absence",
  "Time From": "Heure de début",
  "Time To": "Heure de fin",
  "Re-print": "Réimprimer",
  billet: "billet",
  billets: "billets",
  "No records match your search.": "Aucun enregistrement ne correspond à votre recherche.",
  "No attendance records yet.": "Aucun enregistrement de présence pour le moment.",
  "Generate absence billet": "Générer un billet d'absence",
  "Move to Trash?": "Déplacer vers la corbeille ?",
  "Absence ticket": "Billet d'absence",
  "Archived billet - reprint it at any time.":
    "Billet archivé : réimprimez-le à tout moment.",
  "Generating the billet and saving it to the archive.":
    "Génération du billet et enregistrement dans les archives.",
  "Printable billet d'absence.": "Billet d'absence imprimable.",
  "Course / Subject": "Cours / Matière",
  "Date of absence": "Date d'absence",
  "Verification code": "Code de vérification",
  "Valid document": "Document valide",
  "Keep this ticket as justification": "Conservez ce billet comme justificatif",
  "Saving to the Billets archive.": "Enregistrement dans les archives des billets.",
  "Saved to the Billets archive.": "Enregistré dans les archives des billets.",
  "Retry save": "Réessayer l'enregistrement",
  "Print ticket": "Imprimer le billet",

  // ------------------------------------------------------------- students/teachers
  "Student List": "Liste des étudiants",
  "Add Student": "Ajouter un étudiant",
  "Teacher List": "Liste des enseignants",
  "Add Teacher": "Ajouter un enseignant",

  // --------------------------------------------------------------------- pay
  "Payment History": "Historique des paiements",
  "Payment Trash": "Corbeille des paiements",
  When: "Date",
  Changes: "Modifications",
  "Changed By": "Modifié par",
  "Plan Type": "Type de forfait",
  "Payment Date": "Date de paiement",
  "Deleted At": "Supprimé le",

  // ------------------------------------------------------------ events/publications
  Cover: "Couverture",
  Dates: "Dates",
  Partners: "Partenaires",
  People: "Participants",
  "No events created yet": "Aucun événement créé pour le moment",
  "New Announcement": "Nouvelle annonce",
  "Notification Type": "Type de notification",
  Recipients: "Destinataires",
  "Publish Announcement": "Publier l'annonce",
  "Create a publication to send to teachers and/or students. Messages are recorded but not actually delivered.":
    "Créez une publication destinée aux enseignants et/ou aux étudiants. Les messages sont enregistrés mais ne sont pas réellement envoyés.",
  "Publish an update to the people who need it.":
    "Publiez une actualité pour les personnes concernées.",
  "Enter announcement title": "Saisissez le titre de l'annonce",
  "Enter your message": "Saisissez votre message",
  "Please fill in the title and message.":
    "Veuillez renseigner le titre et le message.",
  "Select at least one recipient.": "Sélectionnez au moins un destinataire.",
  "Announcement published to {recipients}.":
    "Annonce publiée pour {recipients}.",
  "Publishing…": "Publication…",
  Urgent: "Urgent",
  Warning: "Avertissement",
  "Info / News": "Info / Actualités",
  All: "Tous",
  "Published announcements": "Annonces publiées",
  "Loading announcements…": "Chargement des annonces…",
  "{count} announcements": "{count} annonces",
  "Search announcements…": "Rechercher une annonce…",
  "All types": "Tous les types",
  "No announcements yet": "Aucune annonce pour le moment",
  "No announcements match your search.":
    "Aucune annonce ne correspond à votre recherche.",
  "Announcements you publish will appear here.":
    "Les annonces que vous publiez apparaîtront ici.",
  "Try a different search or filter.":
    "Essayez une autre recherche ou un autre filtre.",
  "Delete publication": "Supprimer l'annonce",
  "Delete publication?": "Supprimer l'annonce ?",
  '"{title}" will be moved to the Trash. You can restore it later or permanently delete from there.':
    '"{title}" sera déplacé vers la corbeille. Vous pourrez le restaurer plus tard ou le supprimer définitivement depuis celle-ci.',

  // ---------------------------------------------------------------- dashboard
  "Revenue by Plan": "Revenus par forfait",
  "Students by Program": "Étudiants par programme",
  "Welcome back, {name}": "Bon retour, {name}",

  // ---------------------------------------------------------------- settings
  General: "Général",
  Preferences: "Préférences",
  System: "Système",
  About: "À propos",
  License: "Licence",
  "System-wide configuration for this center.":
    "Configuration de l'établissement.",
  "Branding shown across the operator sidebar and top bar.":
    "Identité visuelle affichée dans la barre latérale et l'en-tête.",
  "System name": "Nom du système",
  "University name": "Nom de l'établissement",
  "Center / university name": "Nom du centre / de l'établissement",
  "University logo": "Logo de l'établissement",
  "Upload logo": "Téléverser un logo",
  "Uploading.": "Téléversement…",
  "Save Settings": "Enregistrer les paramètres",
  "Saving.": "Enregistrement…",
  "Settings saved.": "Paramètres enregistrés.",
  "Logo uploaded. Press Save to store it.":
    "Logo téléversé. Appuyez sur Enregistrer pour le stocker.",
  "PNG or JPEG; downscaled to {width}px wide and uploaded to the Logo bucket. Only the public URL is stored, then shown on the login card.":
    "PNG ou JPEG ; redimensionné à {width} px de large et téléversé dans le bucket Logo. Seule l'URL publique est enregistrée, puis affichée sur la page de connexion.",
  "Academic year": "Année académique",
  Timezone: "Fuseau horaire",
  "IANA zone name used for timetables and dates.":
    "Nom de zone IANA utilisé pour les emplois du temps et les dates.",
  Currency: "Devise",
  "Session timeout (minutes)": "Délai de session (minutes)",
  "Idle minutes before the session expires; 0 disables it.":
    "Minutes d'inactivité avant expiration de la session ; 0 le désactive.",
  "Version & build": "Version et compilation",
  Build: "Compilation",
  "Compiled client details for this deployment.":
    "Détails du client compilé pour ce déploiement.",
  "Center information": "Informations du centre",
  "Values saved on this center's settings row.":
    "Valeurs enregistrées sur la ligne de paramètres de ce centre.",
  "Last backup": "Dernière sauvegarde",
  "License activated.": "Licence activée.",
  "Personal display preferences for this account.":
    "Préférences d'affichage personnelles pour ce compte.",
  Language: "Langue",
  "Select language": "Choisir une langue",
  English: "Anglais",
  "Français": "Français",
  "Dark mode": "Mode sombre",
  "Applies the dark theme across the whole app.":
    "Applique le thème sombre à toute l'application.",
  "Deployment details for this {name} instance.":
    "Détails de déploiement de cette instance {name}.",
  "Check for updates": "Rechercher des mises à jour",
  "Look for a newer version of the application.":
    "Rechercher une version plus récente de l'application.",
  "Check for Updates": "Vérifier les mises à jour",
  "Checking.": "Vérification…",
  "Sync & validate data": "Synchroniser et valider les données",
  "Sync Data": "Synchroniser les données",
  "Syncing.": "Synchronisation…",
  "Scans the attendance log for records missing program, training or class info and backfills them from the matching student/teacher profiles. Stored values are never overwritten, only gaps are filled.":
    "Analyse le registre de présence pour les enregistrements sans programme, formation ou classe et les complète à partir des profils étudiant/enseignant correspondants. Les valeurs existantes ne sont jamais écrasées, seuls les champs manquants sont remplis.",
  Scanned: "Analysés",
  Fixed: "Corrigés",
  Unmatched: "Non associés",
  Failed: "Échecs",
  "Application details for this {name} deployment.":
    "Détails de l'application pour ce déploiement {name}.",
  Version: "Version",
  Frontend: "Frontend",
  "Data layer": "Couche de données",
  Copyright: "Copyright",
  "License renewed successfully!": "Licence renouvelée avec succès !",
  "Preferences saved.": "Préférences enregistrées.",
  "Stored as the app-wide language preference.":
    "Enregistré comme préférence de langue de l'application.",

  // --------------------------------------------------------------------- auth
  Logout: "Déconnexion",
  "Sign out": "Se déconnecter",
  "Are you sure you want to sign out of your session?":
    "Voulez-vous vraiment vous déconnecter de votre session ?",
};

function parseLanguage(value: unknown): Language | null {
  return value === "en" || value === "fr" ? value : null;
}

function languageFromSettingsCache(): Language | null {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { language?: unknown };
    return parseLanguage(parsed?.language);
  } catch {
    return null;
  }
}

function initialLanguage(): Language {
  try {
    return (
      parseLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY)) ??
      languageFromSettingsCache() ??
      "en"
    );
  } catch {
    return "en";
  }
}

let current: Language = initialLanguage();
const listeners = new Set<() => void>();

function applyToDocument(language: Language): void {
  document.documentElement.lang = language;
}

function mirrorLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Private mode/quota - the in-memory store still drives this session.
  }
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    const store =
      typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    store.language = language;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // The settings cache is optional; the DB write is authoritative.
  }
}

// Apply before React renders so the first paint already uses the right copy.
applyToDocument(current);
mirrorLanguage(current);

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): Language {
  return current;
}

export type TranslateVars = Record<string, string | number>;

export type Translate = (key: string, vars?: TranslateVars) => string;

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Translates `key` for an explicit language (defaults to the active one). */
export function translate(
  language: Language,
  key: string,
  vars?: TranslateVars,
): string {
  const template = language === "fr" ? (FRENCH[key] ?? key) : key;
  return interpolate(template, vars);
}

/** Switches the whole app language and persists the choice. */
export function setLanguage(language: Language): void {
  if (parseLanguage(language) == null) return;
  const changed = language !== current;
  current = language;
  applyToDocument(language);
  mirrorLanguage(language);
  if (changed) for (const listener of listeners) listener();
}

/**
 * Applies a language coming from the database/settings cache but ignores
 * unknown or missing values, so a settings table without a language row cannot
 * silently reset the user's cached choice to English.
 */
export function syncLanguageFromSettings(value: string | null | undefined): void {
  const parsed = parseLanguage(value);
  if (parsed) setLanguage(parsed);
}

/** Current language outside React (module helpers, event handlers). */
export function getLanguage(): Language {
  return current;
}

/** Non-reactive translation helper bound to the current language. */
export function t(key: string, vars?: TranslateVars): string {
  return translate(current, key, vars);
}

/** Reactive language + a `t` bound to it. */
export function useI18n(): {
  language: Language;
  t: Translate;
  setLanguage: (language: Language) => void;
} {
  const language = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const translateForLanguage = useCallback<Translate>(
    (key, vars) => translate(language, key, vars),
    [language],
  );
  return useMemo(
    () => ({ language, t: translateForLanguage, setLanguage }),
    [language, translateForLanguage],
  );
}

/** Convenience hook for components that only need the translator. */
export function useT(): Translate {
  return useI18n().t;
}