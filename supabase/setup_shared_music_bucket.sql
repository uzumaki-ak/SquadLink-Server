-- SquadLink shared room music bucket setup
-- Run this in Supabase SQL Editor.
-- Safe to re-run.

-- 1) Create (or update) a public bucket for room-shared music URLs
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'shared-music',
  'shared-music',
  true,
  52428800, -- 50 MB max per file
  array[
    'audio/mpeg',   -- .mp3
    'audio/mp4',    -- .m4a
    'audio/x-m4a',
    'audio/wav',    -- .wav
    'audio/x-wav',
    'audio/aac',
    'audio/ogg'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2) Policies
drop policy if exists "shared_music_read_public" on storage.objects;
create policy "shared_music_read_public"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'shared-music');

drop policy if exists "shared_music_insert_own" on storage.objects;
create policy "shared_music_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'shared-music'
  and owner = auth.uid()
);

drop policy if exists "shared_music_update_own" on storage.objects;
create policy "shared_music_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'shared-music'
  and owner = auth.uid()
)
with check (
  bucket_id = 'shared-music'
  and owner = auth.uid()
);

drop policy if exists "shared_music_delete_own" on storage.objects;
create policy "shared_music_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'shared-music'
  and owner = auth.uid()
);
