-- Where uploaded files live.
--
-- Private, and scoped by a path convention: the first folder of every object key
-- is the owner's user id, which is what the policies below check. A signed upload
-- URL is issued by the server against a path it built, so a client cannot choose
-- somebody else's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800, -- 50MB, the same number FILE_CONSTANTS declares
  null      -- kinds are validated by the upload schema, not by mime sniffing
)
on conflict (id) do update
  set public            = false,
      file_size_limit   = 52428800;

create policy documents_bucket_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy documents_bucket_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy documents_bucket_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
