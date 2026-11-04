-- ============================================================================
-- planning: room / classroom column
-- Paste into: Supabase Dashboard → SQL Editor → New query → Run
-- Idempotent: safe to run more than once.
--
-- The operator's Planification view badges the room a session meets in
-- ("ClassB1", "AC11"). Rooms are not a table in this app, so the value is free
-- text on the planning row. It is optional: existing rows stay NULL and the
-- grid simply renders no room badge for them.
-- ============================================================================

alter table public.planning
  add column if not exists room_name text;

-- The existing planning_anon_all policy from schema.sql already covers the new
-- column, so no policy change is needed.
