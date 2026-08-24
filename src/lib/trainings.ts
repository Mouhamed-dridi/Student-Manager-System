import { listTeacherCourses } from "@/lib/api";

export const PROGRAMS = ["BTP", "BTS", "CAP"] as const;

export type Program = (typeof PROGRAMS)[number];

export const TRAININGS: Record<Program, string[]> = {
  CAP: ["Agent d'entrepôt", "Vendeur caissier étalagiste"],
  BTP: [
    "Préparateur en Pharmacie",
    "Technicien de Soutien en Informatique de Gestion",
    "Comptable d'entreprise",
    "Décoration et Design d'intérieur",
  ],
  BTS: [
    "Maintenance industrielle",
    "Commerce international",
    "Contrôle qualité",
    "Comptable d'entreprise",
    "Développement web",
    "Réseaux et sécurité informatique",
  ],
};

export interface ScheduledCourse {
  name: string;
  day: string;
  time: string;
}

// Prototype schedule data: courses offered per program and training.
export const COURSES: Record<Program, Partial<Record<string, ScheduledCourse[]>>> = {
  CAP: {
    "Gestion caissier": [
      { name: "Cash Register Fundamentals", day: "Monday", time: "08:30–10:30" },
      { name: "Customer Service & Sales", day: "Wednesday", time: "10:45–12:45" },
      { name: "Accounting Software Lab", day: "Friday", time: "14:00–16:00" },
    ],
    Photographe: [
      { name: "Camera & Exposure Basics", day: "Tuesday", time: "08:30–10:30" },
      { name: "Studio Lighting Workshop", day: "Thursday", time: "14:00–17:00" },
      { name: "Photo Editing Lab", day: "Saturday", time: "09:00–11:00" },
    ],
  },
  BTP: {
    "Gestion informatique": [
      { name: "Office Automation Tools", day: "Monday", time: "08:00–10:00" },
      { name: "Database Management", day: "Wednesday", time: "13:00–15:00" },
      { name: "IT Support Practice", day: "Friday", time: "10:15–12:15" },
    ],
    "Développement web": [
      { name: "HTML & CSS Foundations", day: "Monday", time: "10:30–12:30" },
      { name: "JavaScript Essentials", day: "Tuesday", time: "14:00–16:00" },
      { name: "Responsive Web Project", day: "Thursday", time: "08:30–11:30" },
    ],
    "Design infographique": [
      { name: "Graphic Design Principles", day: "Tuesday", time: "08:30–10:30" },
      { name: "Adobe Suite Workshop", day: "Thursday", time: "14:00–16:30" },
      { name: "Branding Mini-Project", day: "Friday", time: "13:00–15:00" },
    ],
  },
  BTS: {
    "Réseaux sécurité informatique": [
      { name: "Network Protocols", day: "Monday", time: "08:00–11:00" },
      { name: "System Administration", day: "Wednesday", time: "14:00–16:00" },
      { name: "Cybersecurity Fundamentals", day: "Friday", time: "08:30–10:30" },
    ],
    "Développement web mobile": [
      { name: "Mobile UI Development", day: "Tuesday", time: "10:30–12:30" },
      { name: "REST APIs & Integration", day: "Thursday", time: "08:00–10:00" },
      { name: "Cross-Platform App Project", day: "Friday", time: "14:00–17:00" },
    ],
    "Gestion et finance": [
      { name: "Financial Accounting", day: "Monday", time: "14:00–16:00" },
      { name: "Management Control", day: "Wednesday", time: "08:30–10:30" },
      { name: "Business Economics", day: "Thursday", time: "10:45–12:45" },
    ],
  },
};

export interface CourseMaterial {
  name: string;
  type: string;
}

export interface TeacherCourseRecord {
  id: string;
  teacherId: string;
  program: string;
  training: string;
  name: string;
  day: string;
  time: string;
  thumbnail?: string;
  published?: string;
  materials?: CourseMaterial[];
}

export interface ScheduledCourseView extends ScheduledCourse {
  id?: string;
  teacherId?: string;
  thumbnail?: string;
  published?: string;
  materials?: CourseMaterial[];
}

// Seeded entries carry no id/teacherId; teacher-created ones do.
// Teacher-created courses come from Supabase, so this is async now.
export async function loadScheduledCourses(
  program: string,
  training: string,
): Promise<ScheduledCourseView[]> {
  const seeded: ScheduledCourseView[] =
    COURSES[program as Program]?.[training] ?? [];
  const added = (await listTeacherCourses())
    .filter((c) => c.program === program && c.training === training)
    .map(
      ({ id, teacherId, name, day, time, thumbnail, published, materials }) => ({
        id,
        teacherId,
        name,
        day,
        time,
        thumbnail,
        published,
        materials,
      }),
    );
  return [...seeded, ...added];
}
