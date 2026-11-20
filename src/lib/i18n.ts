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
  "Search by name or class...": "Rechercher par nom ou formation…",
  "Loading attendance…": "Chargement des présences…",
  "Full class": "Classe entière",
  "Generate absence billet for {name}": "Générer un billet d'absence pour {name}",
  "Edit {name}": "Modifier {name}",
  "Delete {name}": "Supprimer {name}",
  "{name} on {date} will move to the Trash, where you can restore it later or delete it permanently.":
    "{name} du {date} sera déplacé vers la corbeille, où vous pourrez le restaurer plus tard ou le supprimer définitivement.",
  "Imported 1 record": "1 enregistrement importé",
  "Imported {count} records": "{count} enregistrements importés",
  "No valid attendance rows found in the selected file.":
    "Aucune ligne de présence valide trouvée dans le fichier sélectionné.",
  "Expected columns: Type, Full Name, Date (Class Name and Time optional).":
    "Colonnes attendues : Type, Nom complet, Date (Classe et Heure facultatives).",
  "No billet matches your search.": "Aucun billet ne correspond à votre recherche.",
  "No billet has been generated yet.": "Aucun billet n'a encore été généré.",
  "Open Attendance Logs": "Ouvrir les registres de présence",
  "Verification Code": "Code de vérification",
  "Absence Date": "Date d'absence",
  "Time From": "Heure de début",
  "Time To": "Heure de fin",
  "Re-print": "Réimprimer",
  "Absence Tickets": "Billets d'absence",
  Preview: "Aperçu",
  Printed: "Imprimé",
  "1 ticket": "1 billet",
  "{count} tickets": "{count} billets",
  "Preview billet for {name}": "Aperçu du billet de {name}",
  "View billet for {name}": "Afficher le billet de {name}",
  "Search student, branch, subject, teacher...":
    "Rechercher (étudiant, filière, matière, enseignant)...",
  "Loading billets…": "Chargement des billets…",
  "A5 · “Save as PDF” keeps a copy":
    "A5 · « Enregistrer au format PDF » conserve une copie",
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

  // ------------------------------------------------------------ planification
  "Planification view": "Vue Planification",
  Timetable: "Emploi du temps",
  "Exam Schedule": "Emploi des examens",
  "PFE Planning": "Planning PFE",
  "This week": "Cette semaine",
  "{count} this week": "{count} cette semaine",
  training: "formation",
  trainings: "formations",
  session: "séance",
  sessions: "séances",
  "in this view": "dans cette vue",
  "+{count} more": "+{count} autres",
  "{count} teachers": "{count} enseignants",
  "Open timetable to add sessions": "Ouvrir l'emploi du temps",
  "Open the timetable to add sessions":
    "Ouvrez l'emploi du temps pour ajouter des séances",
  "No trainings in this track yet.":
    "Aucune formation dans cette filière pour le moment.",
  "Other programs": "Autres programmes",
  "Trainings by track. Open a card for its weekly timetable — the standard slot grid, where sessions, teachers and rooms are edited.":
    "Les formations par filière. Ouvrez une carte pour son emploi du temps hebdomadaire — la grille standard, où se modifient les séances, les enseignants et les salles.",
  "Loading the training overview…":
    "Chargement de l'aperçu des formations…",
  "Previous week": "Semaine précédente",
  "Next week": "Semaine suivante",
  "Unknown teacher": "Enseignant inconnu",
  "Back to Planification": "Retour à la Planification",
  "Branch timetable": "Emploi du temps de la filière",
  "Exam schedule — add or edit this branch’s exam sittings.":
    "Emploi des examens — ajoutez ou modifiez les sessions d'examen de cette filière.",
  "PFE schedule — defences, internships and their jury panels.":
    "Planning PFE — soutenances, stages et leurs jurys.",
  "Weekly timetable — add, move or remove this branch’s sessions.":
    "Emploi du temps hebdomadaire — ajoutez, déplacez ou supprimez les séances de cette filière.",
  "All classes": "Toutes les classes",
  "No class": "Sans classe",
  "Filter by class": "Filtrer par classe",
  "Print / PDF": "Imprimer / PDF",
  "Print this week or save it as a PDF":
    "Imprimer cette semaine ou l'enregistrer en PDF",
  "Add session": "Ajouter une séance",
  "Add first session": "Ajouter la première séance",
  "Add Session": "Ajouter la séance",
  "{count} session clashes": "{count} séance en conflit",
  "{count} sessions clash": "{count} séances en conflit",
  "with another session this week — a teacher, room or class is double-booked. Flagged cards carry a warning icon.":
    "avec une autre séance cette semaine — un enseignant, une salle ou une classe est doublement réservé. Les cartes concernées portent une icône d'avertissement.",
  "No sessions planned for this branch this week.":
    "Aucune séance prévue pour cette filière cette semaine.",
  "Use the + in any slot below, or add a session to another week.":
    "Utilisez le + dans un créneau ci-dessous, ou ajoutez une séance à une autre semaine.",
  Mon: "Lun",
  Tue: "Mar",
  Wed: "Mer",
  Thu: "Jeu",
  Fri: "Ven",
  Sat: "Sam",
  Sun: "Dim",
  Jury: "Jury",
  "This session clashes with another one":
    "Cette séance est en conflit avec une autre",
  "Add a session on {date} at {slot}":
    "Ajouter une séance le {date} à {slot}",
  "Edit session": "Modifier la séance",
  "New session": "Nouvelle séance",
  "Conflict warning": "Avertissement de conflit",
  "You can still save — this is a warning, not a block.":
    "Vous pouvez quand même enregistrer — c'est un avertissement, pas un blocage.",
  "Delete session": "Supprimer la séance",
  "Delete session?": "Supprimer la séance ?",
  "Delete Session": "Supprimer la séance",
  "this session": "cette séance",
  "This permanently removes {name} on {date} from the {branch} timetable.":
    "Cela supprime définitivement {name} le {date} de l'emploi du temps de {branch}.",
  "Sessions without a time window are grouped in the last row.":
    "Les séances sans horaire sont regroupées dans la dernière ligne.",
  "Pick a date for this session before saving.":
    "Choisissez une date pour cette séance avant d'enregistrer.",
  "another session": "une autre séance",
  "This teacher": "Cet enseignant",
  "{name} already teaches “{subject}”{window}.":
    "{name} enseigne déjà « {subject} »{window}.",
  "Room {room} is already used by “{subject}”{window}.":
    "La salle {room} est déjà utilisée par « {subject} »{window}.",
  "Class {class} already has “{subject}”{window}.":
    "La classe {class} a déjà « {subject} »{window}.",

  // ------------------------------------------------------------- students/teachers
  "Student List": "Liste des étudiants",
  "Add Student": "Ajouter un étudiant",
  "Teacher List": "Liste des enseignants",
  "Add Teacher": "Ajouter un enseignant",
  "Teacher profile": "Profil de l'enseignant",
  "Search teachers...": "Rechercher un enseignant...",
  "No teachers match your search or filters.":
    "Aucun enseignant ne correspond à votre recherche ou à vos filtres.",
  "No teachers registered yet.": "Aucun enseignant inscrit pour le moment.",
  "Edit teacher": "Modifier l'enseignant",
  "Delete teacher": "Supprimer l'enseignant",
  "Delete teacher?": "Supprimer l'enseignant ?",
  "The selected file contains no teacher rows.":
    "Le fichier sélectionné ne contient aucune ligne d'enseignant.",
  "Nothing new to import:": "Rien de nouveau à importer :",
  "1 duplicate": "1 doublon",
  "{count} duplicates": "{count} doublons",
  "1 row with missing data": "1 ligne avec des données manquantes",
  "{count} rows with missing data": "{count} lignes avec des données manquantes",
  "Added 1 teacher": "1 enseignant ajouté",
  "Added {count} teachers": "{count} enseignants ajoutés",
  "skipped 1 row with missing data": "1 ligne ignorée (données manquantes)",
  "skipped {count} rows with missing data":
    "{count} lignes ignorées (données manquantes)",
  "Enter specialty (e.g. Cybersecurity & Networking)":
    "Saisissez la spécialité (ex. Cybersécurité & Réseaux)",
  "No trainings yet": "Aucune formation pour le moment",
  "Job Title": "Intitulé du poste",
  "Job title": "Intitulé du poste",
  Company: "Entreprise",
  "Highest qualification": "Diplôme le plus élevé",
  Password: "Mot de passe",
  "Enter password": "Saisissez le mot de passe",
  "Teachers log in with their full name and this password.":
    "Les enseignants se connectent avec leur nom complet et ce mot de passe.",
  "Update Teacher": "Mettre à jour l'enseignant",
  Duplicate: "Doublon",
  New: "Nouveau",
  "1 teacher ready to import": "1 enseignant prêt à importer",
  "{count} teachers ready to import": "{count} enseignants prêts à importer",
  ", 1 duplicate will be skipped": ", 1 doublon sera ignoré",
  ", {count} duplicates will be skipped":
    ", {count} doublons seront ignorés",
  ", 1 row ignored for missing data.":
    ", 1 ligne ignorée pour données manquantes.",
  ", {count} rows ignored for missing data.":
    ", {count} lignes ignorées pour données manquantes.",
  "Student profile": "Profil de l'étudiant",
  "Loading students…": "Chargement des étudiants…",
  "Search students...": "Rechercher un étudiant...",
  Filter: "Filtrer",
  "Clear filters": "Effacer les filtres",
  "No students match your search or filters.":
    "Aucun étudiant ne correspond à votre recherche ou à vos filtres.",
  "No students registered yet.": "Aucun étudiant inscrit pour le moment.",
  "Select all visible students": "Sélectionner tous les étudiants visibles",
  "Select {name}": "Sélectionner {name}",
  "Edit student": "Modifier l'étudiant",
  "Delete student": "Supprimer l'étudiant",
  "Delete student?": "Supprimer l'étudiant ?",
  "{name} will be moved to the Trash. You can restore them later or permanently delete from there.":
    "{name} sera déplacé vers la corbeille. Vous pourrez le restaurer plus tard ou le supprimer définitivement depuis celle-ci.",
  "{count} selected": "{count} sélectionné(s)",
  "Export selected": "Exporter la sélection",
  "Delete selected": "Supprimer la sélection",
  "Clear selection": "Effacer la sélection",
  "Delete 1 selected student?": "Supprimer l'étudiant sélectionné ?",
  "Delete {count} selected students?":
    "Supprimer les {count} étudiants sélectionnés ?",
  "They will be moved to the Trash. You can restore them later or permanently delete from there.":
    "Ils seront déplacés vers la corbeille. Vous pourrez les restaurer plus tard ou les supprimer définitivement depuis celle-ci.",
  "No valid rows found in the selected file.":
    "Aucune ligne valide dans le fichier sélectionné.",
  "Imported 1 student": "1 étudiant importé",
  "Imported {count} students": "{count} étudiants importés",
  "updated 1 existing record": "1 fiche existante mise à jour",
  "updated {count} existing records": "{count} fiches existantes mises à jour",
  "skipped 1 duplicate": "1 doublon ignoré",
  "skipped {count} duplicates": "{count} doublons ignorés",
  "skipped 1 row with missing or invalid data":
    "1 ligne ignorée (données manquantes ou invalides)",
  "skipped {count} rows with missing or invalid data":
    "{count} lignes ignorées (données manquantes ou invalides)",
  "1 row ready to import": "1 ligne prête à importer",
  "{count} rows ready to import": "{count} lignes prêtes à importer",
  ", 1 row will be skipped (missing or invalid data).":
    ", 1 ligne sera ignorée (données manquantes ou invalides).",
  ", {count} rows will be skipped (missing or invalid data).":
    ", {count} lignes seront ignorées (données manquantes ou invalides).",
  "Confirm Import": "Confirmer l'importation",
  "Enter full name": "Saisissez le nom complet",
  "Select program": "Sélectionnez un programme",
  "Select training": "Sélectionnez une formation",
  "Phone Number": "Numéro de téléphone",
  "Enter phone number": "Saisissez le numéro de téléphone",
  "Enter email": "Saisissez l'e-mail",
  Location: "Localisation",
  "City or address": "Ville ou adresse",
  Age: "Âge",
  Education: "Niveau d'études",
  "Select education level": "Sélectionnez le niveau d'études",
  Engagement: "Engagement",
  "Select engagement": "Sélectionnez un engagement",

  // --------------------------------------------------------------------- pay
  "Payment History": "Historique des paiements",
  "Payment Trash": "Corbeille des paiements",
  When: "Date",
  Changes: "Modifications",
  "Changed By": "Modifié par",
  "Plan Type": "Type de forfait",
  "Payment Date": "Date de paiement",
  "Payment Method": "Mode de paiement",
  "Semester / Month": "Semestre / Mois",
  Period: "Période",
  "Deleted At": "Supprimé le",
  "Every payment creation, edit and deletion is recorded here, newest first.":
    "Chaque création, modification et suppression de paiement est enregistrée ici, de la plus récente à la plus ancienne.",
  "Search by student, change or user…":
    "Rechercher par étudiant, modification ou utilisateur…",
  "Filter by action": "Filtrer par action",
  Creations: "Créations",
  Updates: "Modifications",
  Deletions: "Suppressions",
  Created: "Créé",
  Updated: "Modifié",
  Deleted: "Supprimé",
  "Unknown student": "Étudiant inconnu",
  "No field details": "Aucun détail de champ",
  "Loading history…": "Chargement de l'historique…",
  "No payment activity recorded yet.":
    "Aucune activité de paiement enregistrée pour le moment.",
  "Payment history is not available on this database — the payments table has no edit_history column, so only changes made in this session are listed here.":
    "L'historique des paiements n'est pas disponible sur cette base de données — la table payments n'a pas de colonne edit_history, seules les modifications de cette session sont donc listées ici.",
  "No records match your search or filters.":
    "Aucun enregistrement ne correspond à votre recherche ou à vos filtres.",
  By: "Par",

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
  "Edit publication": "Modifier l'annonce",
  "Every published announcement, newest first.":
    "Toutes les annonces publiées, de la plus récente à la plus ancienne.",
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

  // ------------------------------------------------------------------ license
  "Active plan": "Forfait actif",
  "No plan": "Aucun forfait",
  "Not activated": "Non activée",
  "License key": "Clé de licence",
  "Days remaining": "Jours restants",
  Expires: "Expire le",
  "1 Month": "1 mois",
  "3 Months": "3 mois",
  "1 Year": "1 an",
  "Activate a new key": "Activer une nouvelle clé",
  "Activate License": "Activer la licence",
  "Activate Product": "Activer le produit",
  "Activating…": "Activation…",
  "Keys look like M-XXXX-XXXX-XXXX-XXXX-XXXX (four or five groups). Activating restarts the term from today and updates the plan, status and expiration date on this center.":
    "Les clés ressemblent à M-XXXX-XXXX-XXXX-XXXX-XXXX (quatre ou cinq groupes). L'activation redémarre la durée à partir d'aujourd'hui et met à jour le forfait, le statut et la date d'expiration de ce centre.",
  "That license key is not valid.": "Cette clé de licence n'est pas valide.",
  "License verification": "Vérification de la licence",
  "License required": "Licence requise",
  "License expired": "Licence expirée",
  "Checking your license…": "Vérification de votre licence…",
  "The workspace stays locked until a valid license is confirmed.":
    "L'espace de travail reste verrouillé jusqu'à la confirmation d'une licence valide.",
  "The license for this center expired on {date}. Enter a valid key to restore access.":
    "La licence de ce centre a expiré le {date}. Saisissez une clé valide pour rétablir l'accès.",
  "No valid license is active on this center. Enter a valid key to unlock the workspace.":
    "Aucune licence valide n'est active sur ce centre. Saisissez une clé valide pour déverrouiller l'espace de travail.",
  "Accepted key formats": "Formats de clé acceptés",
  "Need help? Contact support at {email}.":
    "Besoin d'aide ? Contactez le support à {email}.",

  // --------------------------------------------------------------------- auth
  Logout: "Déconnexion",
  "Sign out": "Se déconnecter",
  "Are you sure you want to sign out of your session?":
    "Voulez-vous vraiment vous déconnecter de votre session ?",
  "Leave the application?": "Quitter l'application ?",
  "Are you sure you want to leave the Student Manager System?":
    "Voulez-vous vraiment quitter l'application ?",
  Stay: "Rester",
  Leave: "Quitter",
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