-- Profile pictures: public `profilePictuer` bucket (spelling is intentional and
-- case-sensitive).
-- Idempotent — safe to run more than once. Paste into the Supabase SQL Editor.
--
-- The bucket already exists in the live project but has no anon write policies,
-- so uploads from Settings fail with "new row violates row-level security
-- policy" (code 42501). This file grants the same anon/authenticated access the
-- other app buckets use (see exam-attachment-migration.sql), including update
-- and delete so re-uploading and "Remove" work.
--
-- Photos are stored at the bucket root as `<userId>-<random>.<ext>`; the public
-- URL is written to `user_profiles.avatar_url`.

insert into storage.buckets (id, name, public)
values ('profilePictuer', 'profilePictuer', true)
on conflict (id) do update set public = excluded.public;

do $$
declare
  b text;
begin
  foreach b in array array['profilePictuer'] loop
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

    execute format('drop policy if exists %I on storage.objects', b || ' update anon');
    execute format(
      'create policy %I on storage.objects for update to anon using (bucket_id = %L) with check (bucket_id = %L)',
      b || ' update anon', b, b);

    execute format('drop policy if exists %I on storage.objects', b || ' update authenticated');
    execute format(
      'create policy %I on storage.objects for update to authenticated using (bucket_id = %L) with check (bucket_id = %L)',
      b || ' update authenticated', b, b);

    execute format('drop policy if exists %I on storage.objects', b || ' delete anon');
    execute format(
      'create policy %I on storage.objects for delete to anon using (bucket_id = %L)',
      b || ' delete anon', b);

    execute format('drop policy if exists %I on storage.objects', b || ' delete authenticated');
    execute format(
      'create policy %I on storage.objects for delete to authenticated using (bucket_id = %L)',
      b || ' delete authenticated', b);
  end loop;
end $$;
