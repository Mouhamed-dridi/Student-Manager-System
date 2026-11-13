-- ------------------------------------------------------- center_settings ----
-- Single-row app configuration for the center (id = 1).
--
-- Everything the operator edits in Settings lives here: branding (General),
-- language/dark mode (Preferences), deployment parameters (System), the license
-- (License) and the last backup stamp (Backup & Export). The app reads row 1 at
-- boot (before login) and upserts row 1 on Save, so this table replaces the
-- key/value `settings` rows the app used to write.
--
-- Paste into the SQL Editor; the block is idempotent.

create table if not exists public.center_settings (
  -- The check keeps the table single-row: id can only ever be 1.
  id integer primary key default 1 check (id = 1),
  system_name text,
  university_name text,
  logo_url text,
  language text default 'en' check (language in ('en', 'fr')),
  dark_mode boolean not null default false,
  academic_year text,
  timezone text default 'Africa/Tunis',
  currency text default 'TND',
  session_timeout_minutes integer default 60,
  license_key text,
  license_plan text,
  license_status text default 'inactive',
  license_expires_at timestamptz,
  last_backup_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Column gaps: CREATE TABLE IF NOT EXISTS never adds columns to a table that
-- already exists, so an earlier draft of this table is patched here.
alter table public.center_settings
  add column if not exists system_name text,
  add column if not exists university_name text,
  add column if not exists logo_url text,
  add column if not exists language text default 'en',
  add column if not exists dark_mode boolean not null default false,
  add column if not exists academic_year text,
  add column if not exists timezone text default 'Africa/Tunis',
  add column if not exists currency text default 'TND',
  add column if not exists session_timeout_minutes integer default 60,
  add column if not exists license_key text,
  add column if not exists license_plan text,
  add column if not exists license_status text default 'inactive',
  add column if not exists license_expires_at timestamptz,
  add column if not exists last_backup_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- The single row the app always reads and writes.
insert into public.center_settings (id) values (1)
on conflict (id) do nothing;

-- One-time seed from the legacy key/value `settings` rows so an existing
-- center keeps its branding, language, dark mode and license on first run.
-- Stored values are never overwritten (only NULL columns are filled).
do $$
begin
  if to_regclass('public.settings') is not null then
    update public.center_settings c
    set
      system_name = coalesce(nullif(c.system_name, ''), (
        select value #>> '{}' from public.settings where key = 'system_name'
      )),
      university_name = coalesce(nullif(c.university_name, ''), (
        select value #>> '{}' from public.settings where key = 'university_name'
      )),
      logo_url = coalesce(nullif(c.logo_url, ''), (
        select value #>> '{}' from public.settings where key = 'logo_url'
      )),
      language = coalesce(c.language, (
        select value #>> '{}' from public.settings where key = 'language'
      )),
      dark_mode = case
        when c.dark_mode then true
        else coalesce((
          select (value #>> '{}')::boolean from public.settings
          where key = 'dark_mode'
        ), false)
      end,
      license_key = coalesce(nullif(c.license_key, ''), (
        select value #>> '{}' from public.settings where key = 'license_token'
      )),
      license_expires_at = coalesce(c.license_expires_at, (
        select (value #>> '{}')::timestamptz + interval '12 months'
        from public.settings where key = 'license_activated_at'
      ))
    where c.id = 1;

    update public.center_settings
    set license_status = 'active'
    where id = 1
      and license_expires_at is not null
      and license_expires_at > now()
      and (license_status is null or license_status <> 'active');
  end if;
end $$;

-- RLS: the app has no Supabase Auth accounts and shares the anon/publishable
-- key, so the same full-access policy as the other tables applies.
alter table public.center_settings enable row level security;
do $$
begin
  create policy center_settings_anon_all on public.center_settings
    for all to anon using (true) with check (true);
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------- Storage: 'Logo' ----
-- Settings > General uploads the center logo here; only the public URL is
-- stored in center_settings.logo_url. Bucket ids are case-sensitive, and the
-- app uploads to 'Logo' (not the legacy 'university-logo'), which older rows
-- keep serving through their absolute URLs.
insert into storage.buckets (id, name, public)
values ('Logo', 'Logo', true)
on conflict (id) do update set public = excluded.public;

do $$
begin
  execute 'drop policy if exists "Logo read anon" on storage.objects';
  execute 'create policy "Logo read anon" on storage.objects '
       || 'for select to anon using (bucket_id = ''Logo'')';

  execute 'drop policy if exists "Logo read authenticated" on storage.objects';
  execute 'create policy "Logo read authenticated" on storage.objects '
       || 'for select to authenticated using (bucket_id = ''Logo'')';

  execute 'drop policy if exists "Logo insert anon" on storage.objects';
  execute 'create policy "Logo insert anon" on storage.objects '
       || 'for insert to anon with check (bucket_id = ''Logo'')';

  execute 'drop policy if exists "Logo insert authenticated" on storage.objects';
  execute 'create policy "Logo insert authenticated" on storage.objects '
       || 'for insert to authenticated with check (bucket_id = ''Logo'')';
end $$;
