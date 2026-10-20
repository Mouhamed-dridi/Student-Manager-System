-- Exams: attach PDFs through Supabase Storage.
-- Idempotent — safe to run more than once. Paste into the Supabase SQL Editor.
--
-- Adds the `attachment_url` column (the public URL returned by Storage) and
-- creates the public `exam` bucket with the same anon policies as the other
-- app buckets. `file_name` still holds the display name.

alter table public.exams
  add column if not exists attachment_url text;

insert into storage.buckets (id, name, public)
values ('exam', 'exam', true)
on conflict (id) do update set public = excluded.public;

do $$
declare
  b text;
begin
  foreach b in array array['exam'] loop
    execute format('drop policy if exists %I on storage.objects', b || ' read anon');
    execute format(
      'create policy %I on storage.objects for select to anon using (bucket_id = %L)',
      b || ' read anon', b);

    execute format('drop policy if exists %I on storage.objects', b || ' read authenticated');
    execute format(
      'create policy %I on storage.objects for select to authenticated using (bucket_id = %L)',
      b || ' read authenticated', b);

    execute format('drop policy if exists %I on storage.objects', b || ' insert anon');
    execute format(
      'create policy %I on storage.objects for insert to anon with check (bucket_id = %L)',
      b || ' insert anon', b);

    execute format('drop policy if exists %I on storage.objects', b || ' insert authenticated');
    execute format(
      'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L)',
      b || ' insert authenticated', b);
  end loop;
end $$;
