export const PROGRAMS = ["BTP", "BTS", "CAP"] as const;

export type Program = (typeof PROGRAMS)[number];

export const TRAININGS: Record<Program, string[]> = {
  CAP: ["Gestion caissier", "Photographe"],
  BTP: [
    "Gestion informatique",
    "Développement web",
    "Design infographique",
  ],
  BTS: [
    "Réseaux sécurité informatique",
    "Développement web mobile",
    "Gestion et finance",
  ],
};
