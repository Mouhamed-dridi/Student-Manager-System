-- ---------------------------------------------------------- absence billets --
-- Archive of generated student absence tickets ("billets d'absence").
--
-- A billet is a printable snapshot: the student's name, class, course and the
-- absence date/time are copied in from the attendance row at generation time
-- instead of being joined back through `attendance`, which can be edited,
-- trashed or purged afterwards. `code` is the unique verification code printed
-- on the ticket and shown in the archive.
--
-- Idempotent: safe to paste into the Supabase SQL Editor more than once.
-- Until this runs the Billets page shows an empty archive and generating a
-- billet fails with a message pointing here.

create table if not exists public.absence_billets (
  id uuid primary key default gen_random_uuid(),
  -- No FK: the log row may be purged while the ticket is still archived.
  attendance_id uuid,
  student_name text not null,
  class_name text,
  program text,
  training text,
  course text,
  absence_date date,
  absence_time text,
  code text not null unique,
  created_at timestamptz not null default now()
);

-- The archive always reads newest first and searches by student name.
create index if not exists absence_billets_created_idx
  on public.absence_billets (created_at desc);

create index if not exists absence_billets_student_idx
  on public.absence_billets (student_name);

-- Same policy model as every other table: no Supabase Auth, one shared anon
-- key, so RLS grants full access and is not an authorization boundary.
alter table public.absence_billets enable row level security;

do $$
begin
  begin
    create policy absence_billets_anon_all on public.absence_billets
      for all to anon using (true) with check (true);
  exception when duplicate_object then null;
  end;
end $$;
