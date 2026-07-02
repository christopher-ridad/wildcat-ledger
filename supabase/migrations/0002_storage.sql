-- Storage bucket + policies, replacing storage.rules.
-- Path convention: clubs/{orgId}/transactions/{transactionId}/{type}_{timestamp}_{filename}

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Authenticated org members can read/write anywhere under their org's prefix.
create policy "members can read org documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'clubs'
    and is_org_member_by_org_id_text((storage.foldername(name))[2])
  );

create policy "members can write org documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'clubs'
    and is_org_member_by_org_id_text((storage.foldername(name))[2])
  );

-- Anonymous uploads, restricted to the document filename pattern the
-- upload-by-email-link flow uses (mirrors storage.rules' permissive write).
-- The resulting URL can only be attached to a transaction via
-- submit_document_upload(), which requires the single-use token.
create policy "anon can upload requested documents" on storage.objects
  for insert to anon
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'clubs'
    and (storage.filename(name)) ~ '^(receipt|contract|w9|contractedServices|conflictOfInterest)_'
  );
