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
  Time: "Horaire",
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
  Materials: "Supports",
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
  "Display preferences for your student workspace.":
    "Préférences d'affichage de votre espace étudiant.",
  "English (EN)": "English (EN)",
  "Français (FR)": "Français (FR)",
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

  // ------------------------------------------------- student absence page
  "Total Absences": "Total des absences",
  "Latest Absence": "Dernière absence",
  Classes: "Classes",
  "{count} records": "{count} enregistrements",
  "No absences have been recorded for your account.":
    "Aucune absence n'a été enregistrée pour votre compte.",
  "Search by date, time or class…":
    "Rechercher par date, heure ou classe…",
  "No results match your search.":
    "Aucun résultat ne correspond à votre recherche.",

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
  "Add a session": "Ajouter une séance",
  "Add session on {date}": "Ajouter une séance le {date}",
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

  // ------------------------------------------------- planning entry modal
  "Planning entry": "Saisie du planning",
  "Course or session title (e.g. Introduction SAP ERP, Practical workshop...)":
    "Titre du cours ou de la séance (ex. Introduction SAP ERP, Atelier pratique...)",
  Course: "Cours",
  "Session Type": "Type de séance",
  "Classroom / Room": "Salle",
  "Session location": "Lieu de la séance",
  "Topic / course details": "Sujet / détails du cours",
  to: "à",
  "Add Entry": "Ajouter",
  "Select class": "Sélectionner une classe",
  "No class assigned": "Aucune classe assignée",
  "Select course": "Sélectionner un cours",
  "Select subject": "Sélectionner une matière",
  "No courses available": "Aucun cours disponible",
  "Select teacher": "Sélectionner un enseignant",
  "Select classroom": "Sélectionner une salle",
  "Select a time slot": "Sélectionner un créneau",
  "Custom times…": "Horaires personnalisés…",
  "Session start time": "Heure de début de la séance",
  "Session end time": "Heure de fin de la séance",
  "Changing the date moves the session.":
    "Changer la date déplace la séance.",
  "Fixed by the branch this timetable belongs to.":
    "Fixé par la filière à laquelle appartient cet emploi du temps.",
  "End time must be after the start time.":
    "L'heure de fin doit être postérieure à l'heure de début.",
  "Optional. Pick a slot, or use custom times for any other window.":
    "Facultatif. Choisissez un créneau ou des horaires personnalisés pour toute autre plage.",
  "e.g. Chapter 3: IP Routing Protocols, or Lab 2: React Hooks":
    "ex. Chapitre 3 : Protocoles de routage IP, ou TP 2 : Hooks React",
  "Comment / internal note": "Commentaire / note interne",
  "Administrative note, e.g. exam room change or a reminder…":
    "Note administrative, ex. changement de salle d'examen ou un rappel…",
  "Optional. Internal only — students never see this.":
    "Facultatif. Interne uniquement — les étudiants ne le voient jamais.",
  "Shown as a badge next to the session time in every planning view.":
    "Affiché sous forme de badge à côté de l'horaire dans toutes les vues du planning.",
  "Online sessions meet on {platform}, so no classroom is assigned.":
    "Les séances en ligne se tiennent sur {platform}, aucune salle n'est donc assignée.",
  "{count} teacher is linked to {course}. Changing this moves the session to that teacher's planning.":
    "{count} enseignant est lié à {course}. Le modifier déplace la séance dans le planning de cet enseignant.",
  "{count} teachers are linked to {course}. Changing this moves the session to that teacher's planning.":
    "{count} enseignants sont liés à {course}. Le modifier déplace la séance dans le planning de cet enseignant.",
  "No teacher is linked to {course} yet — showing all teachers.":
    "Aucun enseignant n'est encore lié à {course} — tous les enseignants sont affichés.",
  "Changing this moves the session to that teacher's planning.":
    "Le modifier déplace la séance dans le planning de cet enseignant.",
  "Delete entry {course}": "Supprimer la séance {course}",
  "Delete entry?": "Supprimer la séance ?",
  "Delete Entry": "Supprimer",
  "This will permanently remove the logged entry of {date}.":
    "Cela supprimera définitivement l'entrée du {date}.",
  "This will permanently remove the logged entry of {date} for “{course}”.":
    "Cela supprimera définitivement l'entrée du {date} pour « {course} ».",

  // --------------------------------------- planning categories & daily material
  "Planning category": "Catégorie de planification",
  Category: "Catégorie",
  "Course & Materials": "Cours & supports",
  "Exam Planning": "Planification d'examen",
  "Exam Type": "Type d'examen",
  "PFE Milestone": "Jalon PFE",
  "Exam notes": "Notes d'examen",
  "Jury / supervision notes": "Notes du jury / suivi",
  "e.g. DS on Chapter 4 — closed book, calculators allowed":
    "ex. DS sur le chapitre 4 — documents interdits, calculatrice autorisée",
  "e.g. Mid-project review with the supervisor and the jury":
    "ex. Revue de mi-projet avec le superviseur et le jury",
  "Lesson material": "Support du cours",
  "Material attached": "Support joint",
  "https://… link to the slides, PDF or resource used in class":
    "https://… lien vers les diapositives, le PDF ou la ressource utilisée en cours",
  "Upload a lesson material": "Téléverser un support de cours",
  "Remove material": "Supprimer le support",
  "Optional. Students see this material on their schedule for that day.":
    "Facultatif. Les étudiants voient ce support dans leur emploi du temps ce jour-là.",
  "Filter by category": "Filtrer par catégorie",
  PFE: "PFE",
  Exam: "Examen",
  "Logged session": "Séance enregistrée",
  "Grid View": "Vue grille",
  "Linear View": "Vue linéaire",
  "Planning view": "Vue du planning",
  "Linear view scope": "Périmètre de la vue linéaire",
  "Current Week": "Semaine en cours",
  "All Sessions": "Toutes les séances",
  "Export as Excel": "Exporter en Excel",
  "Export as PDF": "Exporter en PDF",
  "Search course, class or topic…":
    "Rechercher un cours, une classe ou un sujet…",
  "Search planning entries": "Rechercher dans le planning",
  "No sessions match your search.":
    "Aucune séance ne correspond à votre recherche.",
  "No sessions logged this week.":
    "Aucune séance enregistrée cette semaine.",
  "No sessions logged yet.": "Aucune séance enregistrée pour le moment.",
  Today: "Aujourd'hui",
  "No sessions": "Aucune séance",
  "Add an entry to this day": "Ajouter une entrée à ce jour",
  "Add an entry on {date}": "Ajouter une entrée le {date}",
  "Topic covered": "Sujet traité",
  entry: "entrée",
  entries: "entrées",
  "Click any day to log what was studied with your class.":
    "Cliquez sur un jour pour consigner ce qui a été étudié avec votre classe.",
  "Loading planning…": "Chargement du planning…",

  // --------------------------------------- planning session types (i18n labels)
  "In-class": "En présentiel",
  Online: "En ligne",
  Supervision: "Suivi PFE",
  "Pre-defense": "Pré-soutenance",
  "Final defense": "Soutenance PFE",
  "Graded practical": "TP noté",
  DS: "DS",
  TD: "TD",
  Principale: "Principale",
  SYNTHESIS: "SYNTHÈSE",

  // ------------------------------------------------------------------- events
  "Create New Event": "Nouvel événement",
  "Edit Event": "Modifier l'événement",
  "Set the essentials now — you can refine the details later.":
    "Définissez l'essentiel maintenant — vous pourrez affiner les détails ensuite.",
  "Event name": "Nom de l'événement",
  "e.g. Regional Cybersecurity Hackathon":
    "ex. Hackathon régional de cybersécurité",
  "Starts": "Début",
  "Ends": "Fin",
  "Location / Google Maps link": "Lieu / lien Google Maps",
  "https://maps.app.goo.gl/… or Room B-12":
    "https://maps.app.goo.gl/… ou Salle B-12",
  "Event type": "Type d'événement",
  "Keeping the existing type: {type}":
    "Conservation du type existant : {type}",
  "Gift categories": "Catégories de cadeaux",
  "Select all that apply": "Sélectionnez tout ce qui s'applique",
  "Also keeping: {list}": "Également conservé : {list}",
  "What is this event about? Agenda, speakers, what to bring…":
    "De quoi parle cet événement ? Programme, intervenants, à apporter…",
  "Partner name": "Nom du partenaire",
  "Add": "Ajouter",
  "No link": "Aucun lien",
  "Remove {name}": "Supprimer {name}",
  "Cover banner": "Bannière de couverture",
  "Upload cover image": "Importer une image de couverture",
  "Drag & drop or click to browse. JPG or PNG.":
    "Glissez-déposez ou cliquez pour parcourir. JPG ou PNG.",
  "Recommended 1200 × 1200": "Recommandé 1200 × 1200",
  "Change image": "Changer l'image",
  "Remove cover": "Supprimer la couverture",
  "Event cover preview": "Aperçu de la couverture",
  "Your event title": "Titre de votre événement",
  "Date to be announced": "Date à annoncer",
  "The cover and details appear on the teacher portal as soon as you save.":
    "La couverture et les détails apparaissent sur le portail enseignant dès l'enregistrement.",
  "Only the event name is required.": "Seul le nom de l'événement est requis.",
  "Choose an image file for the cover.":
    "Choisissez un fichier image pour la couverture.",
  "Add a partner name or a partner link.":
    "Ajoutez un nom ou un lien de partenaire.",
  "Please give the event a title.": "Veuillez donner un titre à l'événement.",
  "The end date cannot be before the start date.":
    "La date de fin ne peut pas précéder la date de début.",
  "The end time cannot be before the start time.":
    "L'heure de fin ne peut pas précéder l'heure de début.",
  "Create event": "Créer l'événement",
  Event: "Événement",
  Workshop: "Atelier",
  Hackathon: "Hackathon",
  Talks: "Conférence",
  Publication: "Publication",
  "New Training": "Nouvelle formation",
  Money: "Argent",
  Certification: "Certification",
  Gadget: "Gadget",
  Other: "Autre",

  // ----------------------------------------------------------- event history
  "Every event that has been created. Use Edit to change one, or Events → New Event to add another.":
    "Tous les événements créés. Utilisez Modifier pour en changer un, ou Événements → Nouvel événement pour en ajouter un autre.",
  "Search by title, partner or type…":
    "Rechercher par titre, partenaire ou catégorie…",
  "No events match your search.":
    "Aucun événement ne correspond à votre recherche.",
  "{shown} of {total} events shown":
    "{shown} sur {total} événements affichés",
  event: "événement",
  events: "événements",
  participant: "participant",
  participants: "participants",
  organizer: "organisateur",
  organizers: "organisateurs",
  member: "membre",
  members: "membres",
  Unknown: "Inconnu",
  "Organizers: {names}": "Organisateurs : {names}",
  "Members: {names}": "Membres : {names}",
  "Organizers and members are stored as ids; names are resolved live.":
    "Les organisateurs et les membres sont stockés sous forme d'identifiants ; les noms sont résolus en direct.",
  "Delete event": "Supprimer l'événement",
  "Delete event?": "Supprimer l'événement ?",
  "{name} will be hidden from this list. The row is kept in the database.":
    "{name} sera masqué de cette liste. La ligne reste dans la base de données.",
  "{name} was deleted.": "{name} a été supprimé.",
  "Loading events…": "Chargement des événements…",
  "Hackathons, trainings and ceremonies published by the school.":
    "Hackathons, formations et cérémonies publiés par l'école.",
  "{count} event": "{count} événement",
  "{count} events": "{count} événements",
  "No event has been published yet.":
    "Aucun événement n'a encore été publié.",
  "No description provided.": "Aucune description fournie.",
  "Events you create will be listed here, with their cover image, schedule and participants.":
    "Les événements que vous créez seront listés ici, avec leur image de couverture, leur programme et leurs participants.",
  "View Event History": "Voir l'historique des événements",
  "Create center events, workshops, hackathons, and talks, or manage published ones from Event History.":
    "Créez des événements, ateliers, hackathons et conférences pour le centre, ou gérez les événements publiés depuis l'historique des événements.",

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
  "Total Paid": "Total payé",
  "Remaining Balance": "Reste à payer",
  "Last Payment": "Dernier paiement",
  Paid: "Payé",
  Pending: "En attente",
  Receipt: "Reçu",
  "Payment Receipt": "Reçu de paiement",
  "Preview and print a receipt ticket for this payment.":
    "Aperçu et impression d'un reçu pour ce paiement.",
  "Optimized for 80mm receipt paper":
    "Optimisé pour papier thermique 80 mm",
  "Print receipt": "Imprimer le reçu",
  "Thank you": "Merci",
  "No payments recorded yet.": "Aucun paiement enregistré pour le moment.",
  "Track your payments and tuition installments.":
    "Consultez vos paiements et échéances de scolarité.",
  Monthly: "Mensuel",
  Semester: "Semestriel",
  "One-Time": "Paiement unique",
  Plan: "Forfait",
  Method: "Mode",
  "Recorded at": "Enregistré le",
  "Issued at": "Émis le",
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
  Participants: "Participants",
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
  Warnings: "Avertissements",
  "Info / News": "Info / Actualités",
  Infos: "Infos",
  All: "Tous",
  "Messages and news published to students.":
    "Messages et actualités publiés pour les étudiants.",
  "No announcements match your filter.":
    "Aucune annonce ne correspond à votre filtre.",
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
  "Loading your dashboard…": "Chargement de votre tableau de bord…",
  "Personalize your dashboard": "Personnaliser le tableau de bord",
  "All widgets are hidden. Use {action} to bring some back.":
    "Tous les widgets sont masqués. Utilisez « {action} » pour en réafficher.",

  // ------------------------------------------------------- student dashboard
  "Enrolled Courses": "Cours inscrits",
  "Next: {course}": "Suivant : {course}",
  "No courses scheduled yet": "Aucun cours planifié pour le moment",
  "Pending Payments": "Paiements en attente",
  "{amount} outstanding": "{amount} à régler",
  "Nothing outstanding": "Aucun solde dû",
  "Attendance Record": "Suivi des présences",
  "Last entry {date}": "Dernière entrée {date}",
  "No entries logged yet": "Aucune entrée enregistrée",
  "Upcoming Exams": "Examens à venir",
  "Exams ahead for your class": "Examens à venir pour votre classe",
  "Nothing scheduled. You are all caught up.":
    "Rien de prévu. Vous êtes à jour.",
  "Untitled exam": "Examen sans titre",
  "Recent Announcements": "Annonces récentes",
  "Notices sent to students": "Avis envoyés aux étudiants",
  "No announcements yet.": "Aucune annonce pour le moment.",
  "Course Materials Quick Access": "Accès rapide aux supports",
  "Files attached to your courses": "Fichiers joints à vos cours",
  "1 file across your courses": "1 fichier dans vos cours",
  "{count} files across your courses": "{count} fichiers dans vos cours",
  "No course materials have been attached yet.":
    "Aucun support de cours n'a encore été ajouté.",
  "Customize Dashboard Widgets": "Personnaliser les widgets du tableau de bord",
  "Choose which cards and charts appear on your dashboard. This preference is saved in this browser.":
    "Choisissez les cartes et graphiques affichés sur votre tableau de bord. Cette préférence est enregistrée dans ce navigateur.",
  "All widgets shown": "Tous les widgets sont affichés",
  "1 widget hidden": "1 widget masqué",
  "{count} widgets hidden": "{count} widgets masqués",
  "Save Preferences": "Enregistrer les préférences",
  "Dismiss notification": "Masquer la notification",
  "Restore dismissed announcements": "Restaurer les annonces masquées",
  "No announcements are dismissed.": "Aucune annonce n'est masquée.",
  "1 announcement dismissed": "1 annonce masquée",
  "{count} announcements dismissed": "{count} annonces masquées",
  "Enrolled Courses Progress": "Progression des cours inscrits",
  "Your class courses and the material attached to them.":
    "Les cours de votre classe et les supports qui y sont joints.",
  "Invoices still waiting to be settled.":
    "Factures restant à régler.",
  "Attendance entries logged against your name.":
    "Les présences enregistrées à votre nom.",
  "Exams ahead for your class.":
    "Les examens à venir pour votre classe.",
  "Notices sent to students.": "Les avis envoyés aux étudiants.",
  "Downloads attached to your courses.":
    "Les fichiers joints à vos cours.",

  // ------------------------------------------------------- student courses
  "Assigned to {training} ({program})":
    "Assigné à {training} ({program})",
  "All Materials ({count})": "Tous les supports ({count})",
  Subjects: "Matières",
  "All subjects": "Toutes les matières",
  "Filter by subject": "Filtrer par matière",
  "Show all subjects": "Afficher toutes les matières",
  "No courses available for this subject":
    "Aucun cours disponible pour cette matière",
  "Try selecting a different subject or view all subjects.":
    "Essayez une autre matière ou affichez toutes les matières.",
  "No course materials have been uploaded for your scheduled subjects yet.":
    "Aucun support n'a encore été publié pour les matières de votre planification.",
  "Your planification lists subjects, but no course has been published for them so far.":
    "Votre planification contient des matières, mais aucun cours n'a encore été publié pour celles-ci.",
  "All supports": "Tous les supports",
  "Filter by support": "Filtrer par support",
  "Show all courses": "Afficher tous les cours",
  "1 material": "1 support",
  "{count} materials": "{count} supports",
  "Added {date}": "Ajouté le {date}",
  "Open {name}": "Ouvrir {name}",
  "Loading courses…": "Chargement des cours…",
  "Course details": "Détails du cours",
  "Back to courses": "Retour aux cours",
  "This course could not be displayed.":
    "Ce cours n'a pas pu être affiché.",
  "An unexpected error occurred.":
    "Une erreur inattendue s'est produite.",
  "No courses match this material":
    "Aucun cours ne correspond à ce support",
  "No courses match this support":
    "Aucun cours ne correspond à ce support",
  "Try selecting a different material or view all courses.":
    "Essayez un autre support ou affichez tous les cours.",
  "Nothing has been planned for your program and training so far. Please check back later.":
    "Rien n'a encore été planifié pour votre programme et votre formation. Revenez plus tard.",

  // ------------------------------------------------------- student planning
  "Weekly schedule": "Emploi du temps hebdomadaire",
  "Your class": "Votre classe",
  "Loading your week…": "Chargement de votre semaine…",
  "Nothing scheduled this week.": "Rien de planifié cette semaine.",
  "No sessions have been logged for your class yet.":
    "Aucune séance n'a encore été enregistrée pour votre classe.",
  "Your class is not linked to a program and training yet, so no sessions can be matched. Ask the administration to complete your record.":
    "Votre classe n'est pas encore reliée à un programme et à une formation : aucune séance ne peut être associée. Demandez à l'administration de compléter votre fiche.",
  "{count} item this week": "{count} séance cette semaine",
  "{count} items this week": "{count} séances cette semaine",
  "Exams appear on their scheduled day and are also listed under Exams.":
    "Les examens apparaissent le jour prévu et figurent aussi dans Examens.",

  // ------------------------------------------------------- course detail
  "Taught by": "Enseigné par",
  Overview: "Aperçu",
  "Skills you'll gain": "Compétences acquises",
  "No description has been added for this course yet.":
    "Aucune description n'a encore été ajoutée pour ce cours.",
  "Course syllabus": "Programme du cours",
  "Course media": "Supports de cours",
  "No materials have been attached to this course yet.":
    "Aucun support n'a encore été joint à ce cours.",
  "Reviews are not available for this scheduled course. Only courses added by a teacher can be rated.":
    "Les avis ne sont pas disponibles pour ce cours planifié. Seuls les cours ajoutés par un enseignant peuvent être notés.",
  "This part of the course could not be displayed.":
    "Cette partie du cours n'a pas pu être affichée.",
  Instructor: "Enseignant",
  Level: "Niveau",
  Duration: "Durée",
  Published: "Publié le",
  "No course details have been published yet.":
    "Aucun détail de cours n'a encore été publié.",
  Beginner: "Débutant",
  Intermediate: "Intermédiaire",
  Medium: "Moyen",
  Video: "Vidéo",
  "Video & Document": "Vidéo & Document",
  Mixed: "Mixte",
  Download: "Télécharger",
  "Word document": "Document Word",
  File: "Fichier",
  "no file attached": "aucun fichier joint",
  "This material was saved before file uploads were available, so the file itself is not available. Ask your teacher to attach it again.":
    "Ce support a été enregistré avant la mise en place des téléversements : le fichier lui-même n'est pas disponible. Demandez à votre enseignant de le joindre à nouveau.",
  "Your browser cannot play this video.":
    "Votre navigateur ne peut pas lire cette vidéo.",
  "This file type cannot be previewed in the browser.":
    "Ce type de fichier ne peut pas être prévisualisé dans le navigateur.",

  // ------------------------------------------------------- course reviews
  "Ratings & reviews": "Notes & avis",
  "1 rating": "1 note",
  "{count} ratings": "{count} notes",
  "Your rating": "Votre note",
  "(required)": "(obligatoire)",
  Comment: "Commentaire",
  "(optional)": "(facultatif)",
  "What did you think of this course?":
    "Qu'avez-vous pensé de ce cours ?",
  "Post review": "Publier l'avis",
  "Posting…": "Publication…",
  "Posted as {name}": "Publié en tant que {name}",
  "Pick a star rating before posting your review.":
    "Choisissez une note avant de publier votre avis.",
  "No reviews yet — be the first to rate this course.":
    "Aucun avis pour le moment — soyez le premier à noter ce cours.",
  "No reviews yet.": "Aucun avis pour le moment.",
  "Loading reviews…": "Chargement des avis…",
  "{value} out of {max} stars": "{value} sur {max} étoiles",
  "1 star": "1 étoile",
  "{count} stars": "{count} étoiles",

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

  // -------------------------------------------------------- backup & restore
  "Backup": "Sauvegarde",
  "Restore": "Restauration",
  "Restore / Import Data": "Restaurer / Importer des données",
  "Restore mode": "Mode de restauration",
  "Restore finished": "Restauration terminée",
  "Restore stopped": "Restauration interrompue",
  "Start restore": "Lancer la restauration",
  "Back up and restore": "Sauvegarder et restaurer",
  "Inspect file": "Inspecter le fichier",
  "Progress & audit": "Progression et audit",
  "Action": "Action",
  "Format": "Format",
  "Mode": "Mode",
  "Rows": "Lignes",
  "Tables": "Tables",
  "Success": "Réussi",
  "Partial": "Partiel",
  "Continue": "Continuer",
  "Back": "Retour",
  "JSON": "JSON",
  "Operator": "Opérateur",
  "Operators": "Opérateurs",
  "Attendance": "Présences",
  "Billets": "Billets",
  "Payments History": "Historique des paiements",
  "Center Settings": "Paramètres du centre",
  "Legacy Settings": "Paramètres hérités",
  "Settings / Config": "Paramètres / Configuration",
  "Performed by": "Effectuée par",
  "Never backed up": "Jamais sauvegardé",
  "Healthy": "À jour",
  "Older than 7 days": "Plus de 7 jours",
  "Full System Backup": "Sauvegarde complète du système",
  "Export Full System Backup": "Exporter la sauvegarde complète",
  "Full system backup downloaded": "Sauvegarde complète téléchargée",
  "Module backups": "Sauvegardes par module",
  "Backup & Restore History": "Historique des sauvegardes et restaurations",
  "Recommended for restore": "Recommandé pour la restauration",
  "SQL script": "Script SQL",
  "INSERT statements for psql or the SQL editor":
    "Instructions INSERT pour psql ou l'éditeur SQL",
  "Download SQL": "Télécharger SQL",
  "Download Excel": "Télécharger Excel",
  "Date & time": "Date et heure",
  "Include deleted (Trash) records": "Inclure les éléments supprimés (corbeille)",
  "Full replace": "Remplacement complet",
  "Merge / Upsert": "Fusion / Upsert",
  "Merge / Upsert (Safe)": "Fusion / Upsert (sûr)",
  "Full Replace (Overwrite)": "Remplacement complet (écrasement)",
  "safety": "sécurité",
  "Skipped:": "Ignorées :",
  "exported as": "exporté en",
  "Admin access required": "Accès administrateur requis",
  "Backup & Export is restricted to operator accounts.":
    "Sauvegarde & export est réservé aux comptes opérateur.",
  "Records detected": "Enregistrements détectés",
  "Target table": "Table cible",
  "Select table…": "Choisir une table…",
  "Choose another file": "Choisir un autre fichier",
  "Drag & drop the backup file here":
    "Glissez-déposez le fichier de sauvegarde ici",
  "The original backup skipped:": "La sauvegarde d'origine a ignoré :",
  "The safety backup could not be written, so nothing was overwritten.":
    "La sauvegarde de sécurité n'a pas pu être écrite, rien n'a été écrasé.",
  "Supported files: .json, .sql, .csv or .xlsx.":
    "Fichiers pris en charge : .json, .sql, .csv ou .xlsx.",
  "The file is larger than 25 MB.": "Le fichier dépasse 25 Mo.",
  "This file is not valid JSON.": "Ce fichier n'est pas un JSON valide.",
  "This JSON file is not a Full System Backup (no tables object).":
    "Ce fichier JSON n'est pas une sauvegarde complète (objet « tables » absent).",
  "The backup file lists no tables.":
    "Le fichier de sauvegarde ne contient aucune table.",
  "The backup file contains an unsupported table: {table}.":
    "Le fichier de sauvegarde contient une table non prise en charge : {table}.",
  "The rows of {table} are not a list of records.":
    "Les lignes de {table} ne forment pas une liste d'enregistrements.",
  "The dump targets an unsupported table: {table}.":
    "Le script cible une table non prise en charge : {table}.",
  "Malformed SQL dump: unterminated tuple.":
    "Script SQL mal formé : parenthèse non fermée.",
  "Malformed SQL dump: column/value mismatch in {table}.":
    "Script SQL mal formé : colonnes et valeurs incohérentes dans {table}.",
  "Unterminated string in the SQL dump.":
    "Chaîne non fermée dans le script SQL.",
  "Malformed value in the SQL dump.":
    "Valeur mal formée dans le script SQL.",
  "No INSERT statements for known tables were found in this file.":
    "Aucune instruction INSERT pour des tables connues n'a été trouvée dans ce fichier.",
  "The sheet is empty or has no header row.":
    "La feuille est vide ou n'a pas de ligne d'en-tête.",
  "Review the backup, choose how it is written, then follow the restore progress.":
    "Vérifiez la sauvegarde, choisissez le mode d'écriture, puis suivez la progression.",
  "Download a complete copy of your center's data as JSON or SQL, export a single module, or restore a previous backup.":
    "Téléchargez une copie complète des données de votre centre en JSON ou SQL, exportez un module, ou restaurez une sauvegarde précédente.",
  "One file with every core table: students, teachers, operators, branches, materials, payments, attendance, billets, planning, exams, publications, events and center settings.":
    "Un seul fichier avec toutes les tables principales : étudiants, enseignants, opérateurs, filières, matières, paiements, présences, billets, planification, examens, publications, événements et paramètres du centre.",
  "SQL and JSON backups keep trashed rows so a restore can bring them back. Excel exports never include them.":
    "Les sauvegardes SQL et JSON conservent les lignes de la corbeille pour qu'une restauration puisse les récupérer. Les exports Excel ne les incluent jamais.",
  "No backup in the last 7 days. Download a fresh Full System Backup before your next changes.":
    "Aucune sauvegarde depuis 7 jours. Téléchargez une nouvelle sauvegarde complète avant vos prochaines modifications.",
  "Every module downloads as a SQL script or an Excel workbook. Use these for a single table instead of the full backup.":
    "Chaque module se télécharge en script SQL ou en classeur Excel. Utilisez-les pour une seule table au lieu de la sauvegarde complète.",
  "No backup or restore has been recorded on this device yet.":
    "Aucune sauvegarde ni restauration n'a encore été enregistrée sur cet appareil.",
  "Restores through the wizard on this page.":
    "Se restaure avec l'assistant de cette page.",
  "Best for manual review and SQL console imports.":
    "Idéal pour une vérification manuelle et les imports via la console SQL.",
  "Updates rows that already exist and adds the missing ones. Nothing is deleted.":
    "Met à jour les lignes existantes et ajoute les manquantes. Rien n'est supprimé.",
  "Deletes the current rows of every table in the file, then writes the backup.":
    "Supprime les lignes actuelles de chaque table du fichier, puis écrit la sauvegarde.",
  "When off, trashed rows in the file are skipped instead of being restored.":
    "Désactivé, les lignes de la corbeille présentes dans le fichier sont ignorées.",
  "A safety backup of the current data downloads automatically before anything is deleted. This cannot be undone.":
    "Une sauvegarde de sécurité des données actuelles se télécharge automatiquement avant toute suppression. Cette action est irréversible.",
  "Reading {name}…": "Lecture de {name}…",
  "Exported on {date}.": "Exporté le {date}.",
  "Safety backup downloaded at {date}.":
    "Sauvegarde de sécurité téléchargée le {date}.",
  "or click to browse · .json backup (SQL and spreadsheets are still accepted)":
    "ou cliquez pour parcourir · sauvegarde .json (les fichiers SQL et tableurs restent acceptés)",
  "{count} rows": "{count} lignes",
  "{count} tables": "{count} tables",
  "{count} entries": "{count} entrées",
  "{count} skipped": "{count} ignorées",
  "{tables} tables · {rows} rows will be written.":
    "{tables} tables · {rows} lignes seront écrites.",
  "{restored} rows restored, {failed} skipped.":
    "{restored} lignes restaurées, {failed} ignorées.",
  "Restoring…": "Restauration…",
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

  // ------------------------------------------------ student settings & profile
  "General Settings": "Paramètres généraux",
  "Profile photo": "Photo de profil",
  "Shown in the top bar of the student portal.":
    "Affichée dans la barre supérieure du portail étudiant.",
  "Upload photo": "Téléverser une photo",
  "Personal Information": "Informations personnelles",
  "Your name is also how you sign in to the student portal.":
    "Votre nom est également utilisé pour vous connecter au portail étudiant.",
  "First Name": "Prénom",
  "First name": "Prénom",
  "Last Name": "Nom",
  "Last name": "Nom",
  "read-only": "lecture seule",
  "Academic Branch & Class": "Filière académique & Classe",
  "Academic Branch": "Filière académique",
  "Admin-managed": "Géré par l'administration",
  "managed by the administration.": "géré par l'administration.",
  "Your location": "Votre localisation",
  "Your age": "Votre âge",
  "New Student": "Nouvel étudiant",
  "Second Year": "Deuxième année",
  "Social media & contact links": "Liens réseaux sociaux & contact",
  "Optional links to your profiles. Leave a field empty to remove it.":
    "Liens facultatifs vers vos profils. Laissez un champ vide pour le supprimer.",
  "Save changes": "Enregistrer les modifications",
  "Changes saved.": "Modifications enregistrées.",
  "First name is required.": "Le prénom est obligatoire.",
  "Age must be a number.": "L'âge doit être un nombre.",
  "Account Information": "Informations du compte",
  "Summary of your registered student account.":
    "Résumé de votre compte étudiant enregistré.",
  "Account Status": "Statut du compte",
  Active: "Actif",
  "Accepted formats: JPG, PNG, or WebP (max 2 MB).":
    "Formats acceptés : JPG, PNG ou WebP (max. 2 Mo).",
  "Uploaded to the profilePictuer Storage bucket; the public URL is saved on your profile (user_profiles) and shown across the portal.":
    "Téléversée dans le bucket de stockage profilePictuer ; l'URL publique est enregistrée sur votre profil et affichée dans le portail.",

  // ------------------------------------------------ teacher settings & profile
  "Shown in the top bar of the teacher portal.":
    "Affichée dans la barre supérieure du portail enseignant.",
  "Your name is also how you sign in to the teacher portal.":
    "Votre nom est également utilisé pour vous connecter au portail enseignant.",
  "Social links": "Liens sociaux",
  "Visible on your profile to students and colleagues.":
    "Visible sur votre profil par les étudiants et vos collègues.",
  "Save Links": "Enregistrer les liens",
  "Links saved.": "Liens enregistrés.",

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