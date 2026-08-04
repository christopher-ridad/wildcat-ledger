// Shared helpers for the 'documents' Storage bucket (supabase/migrations/0002_storage.sql).
// The bucket is private, so we store object *paths* in the transaction record
// (not public URLs) and mint short-lived signed URLs whenever a file is
// displayed or downloaded.

import { supabase } from '../../../config/supabase';

const BUCKET = 'documents';

export const documentPath = (
  orgId: string,
  transactionId: string,
  file: File,
  prefix: string,
) => `clubs/${orgId}/transactions/${transactionId}/${prefix}_${Date.now()}_${file.name}`;

export async function uploadDocument(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;
}

export async function getSignedFileUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function downloadDocument(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  return data;
}
