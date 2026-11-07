-- Payment plan details
-- ---------------------------------------------------------------------------
-- The base `payments` table only stored amount / plan_type / payment_date.
-- The payment creator now also records how the money arrived, which period the
-- plan covers, and the student's program snapshot at payment time.
--
-- All four columns are plain text, constrained only by the app (the same
-- approach as events.type), so a new method or month needs no migration.
-- `create table if not exists` in schema.sql never adds columns to an
-- already-deployed table, which is why this lives in its own idempotent file.
--
-- Run this once in the Supabase SQL Editor, then reload the app.

alter table if exists public.payments
  add column if not exists payment_method text,
  add column if not exists semester text,
  add column if not exists payment_month text,
  add column if not exists student_program text;
