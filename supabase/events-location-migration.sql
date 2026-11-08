-- ============================================================================
-- events: location column
-- Paste into: Supabase Dashboard → SQL Editor → New query → Run
-- Idempotent: safe to run more than once.
--
-- The event creator's "Location / Google Maps link" field stores a free-text
-- venue: a maps.app.goo.gl URL or a plain room/address. It is optional:
-- existing rows stay NULL. The app probes the column at runtime
-- (hasEventsLocationColumn() in src/lib/api.ts) and simply skips it on write
-- when absent, so nothing breaks before this script is run.
-- ============================================================================

alter table public.events
  add column if not exists location text;

-- The existing events_anon_all policy from schema.sql already covers the new
-- column, so no policy change is needed.
