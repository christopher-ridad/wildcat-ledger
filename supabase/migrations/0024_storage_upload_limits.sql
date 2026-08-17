-- Security hardening: the `documents` bucket has never had a file_size_limit
-- or allowed_mime_types set, so neither the authenticated org-member upload
-- policy nor the anonymous email-link upload policy enforces any cap --
-- either can upload arbitrarily large or arbitrary-content files (0002's
-- anon insert policy only pattern-matches the filename prefix). This is a
-- storage-cost/DoS surface with no enforcement anywhere in application code
-- (the frontend's `accept="image/*,application/pdf"` is a UI hint only,
-- trivially bypassed).
--
-- 15 MB comfortably covers a phone photo or scanned PDF receipt/contract;
-- the MIME list matches what the app's file inputs actually advertise
-- (image/*, application/pdf), narrowed to the formats real documents show up
-- as in practice.

update storage.buckets
set
  file_size_limit = 15728640, -- 15 MB
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf'
  ]
where id = 'documents';
