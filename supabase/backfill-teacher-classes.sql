-- Backfill teachers.program / teachers.training so class import can resolve.
--
-- OPTIONAL since teachers.program/training gained a specialty fallback
-- (resolveClassFromSpecialty in src/lib/api.ts), which resolves all 11 current
-- teachers from their `specialty` text alone. Run this only if you would
-- rather store the assignment as real data than depend on that alias table —
-- explicit FKs are the more durable source of truth.
--
-- WHY it exists: every teacher has a free-text `specialty` but program +
-- training were NULL for all 11 rows. Class import keys on the training FKs
-- (teacherCourseAssignment in src/lib/api.ts), never on `specialty`, which has
-- no FK to `trainings` and is written in English while the trainings table
-- holds French trade names.
--
-- Run in the Supabase SQL Editor. Idempotent: re-running rewrites the same
-- values. Uses names/codes rather than UUIDs so it survives a re-seed.
--
-- TWO ENTRIES NEED A HUMAN DECISION — see the flagged lines before running:
--   1. Sabrine Mkacher (Accounting) — "Comptable d'entreprise" exists in BOTH
--      BTP and BTS, each with 5 students. Picked BTP below; change to BTS if
--      she actually teaches the BTS group.
--   2. Lobna Ouertani (ERP Consulting) — there is no ERP training. Mapped to
--      "Technicien de Soutien en Informatique de Gestion", which she then
--      shares a class with Oussama Kahia (IT Support). If that is wrong, add
--      the real ERP training row first, then re-point her line.

BEGIN;

WITH mapping(teacher_name, program_code, training_name) AS (
  VALUES
    ('Elyes Kefi',                'CAP', 'Agent d'entrepôt'),
    ('Rayen Charfi',              'CAP', 'Vendeur caissier étalagiste'),
    ('Nizar Bahri',               'BTP', 'Préparateur en Pharmacie'),
    ('Riadh Slama',               'BTS', 'Commerce international'),
    ('Hela Turki',                'BTS', 'Contrôle qualité'),
    ('Wael Cherif',               'BTS', 'Réseaux et sécurité informatique'),
    ('Oussama Kahia',             'BTP', 'Technicien de Soutien en Informatique de Gestion'),
    ('Manel Chtioui',             'BTP', 'Décoration et Design d''intérieur'),
    ('Bassem Zaghdoudi',          'BTS', 'Maintenance industrielle'),
    -- AMBIGUOUS: BTP vs BTS "Comptable d'entreprise". Change 'BTP' to 'BTS' if needed.
    ('Sabrine Mkacher',           'BTP', 'Comptable d''entreprise'),
    -- NO ERP TRAINING EXISTS: temporarily shares the IT Support class. Re-point if an
    -- ERP training is added later.
    ('Lobna Ouertani',            'BTP', 'Technicien de Soutien en Informatique de Gestion')
)
UPDATE teachers t
SET program  = m.program_code,
    training = m.training_name
FROM mapping m
WHERE t.full_name = m.teacher_name;

COMMIT;

-- Verification: every row below should now show a program + training.
-- Any row still showing NULL was not matched by full_name above (check spelling).
SELECT
  full_name,
  specialty,
  program,
  training,
  CASE
    WHEN program IS NULL OR training IS NULL THEN 'STILL UNRESOLVED'
    ELSE 'ok'
  END AS status
FROM teachers
ORDER BY full_name;
