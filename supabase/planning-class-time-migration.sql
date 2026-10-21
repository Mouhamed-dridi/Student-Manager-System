-- Planning: add the optional Class and session Time fields.
-- Idempotent — safe to run more than once. Paste into the Supabase SQL Editor.
--
-- Both are plain text on purpose: class_name holds the teacher's group label
-- ("BTS · Réseaux et sécurité informatique") and session_time the display
-- window ("08:30 - 10:00"). No CHECK constraint, so older rows stay valid.

alter table public.planning
  add column if not exists class_name text,
  add column if not exists session_time text;
