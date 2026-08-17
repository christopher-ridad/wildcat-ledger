-- The anon-upload storage policy's filename allow-list was never updated
-- when Special Pay Form requests were fixed in 0014 -- an anonymous
-- upload would still be rejected by this RLS policy before ever reaching
-- submit_document_upload(), even though that RPC and UploadDocumentPage's
-- FILE_TYPE_MAP both already accept it. Found while setting up local
-- Supabase for e2e tests, since this policy only executes against a real
-- Postgres instance -- invisible to the mocked Vitest suite.

drop policy "anon can upload requested documents" on storage.objects;

create policy "anon can upload requested documents" on storage.objects
  for insert to anon
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'clubs'
    and (storage.filename(name)) ~ '^(receipt|contract|w9|contractedServices|conflictOfInterest|specialPayForm)_'
  );
