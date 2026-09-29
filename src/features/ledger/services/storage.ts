// Shared helpers for the 'documents' Storage bucket (supabase/migrations/0002_storage.sql).
// The bucket is private, so we store object *paths* in the transaction record
// (not public URLs) and mint short-lived signed URLs whenever a file is
// displayed or downloaded.

import { supabase } from '../../../config/supabase';
import { Transaction } from '../types';

const BUCKET = 'documents';

// Every field on a transaction that holds a Storage object path (as opposed
// to the sibling *NotStored booleans, which mean nothing was ever uploaded).
const DOCUMENT_URL_FIELDS = [
  'receiptFileUrl',
  'contractFileUrl',
  'w9FileUrl',
  'contractedServicesFileUrl',
  'conflictOfInterestFileUrl',
  'specialPayFormUrl',
  'exemptionFormUrl',
] as const satisfies readonly (keyof Transaction)[];

// Every Storage path a transaction snapshot references -- used to clean up
// a deleted transaction's documents, which nothing else does (deleting the
// transactions row has never touched Storage; see
// delete-transaction-documents Edge Function).
export function transactionDocumentPaths(
  transaction: Pick<Transaction, (typeof DOCUMENT_URL_FIELDS)[number]>,
): string[] {
  return DOCUMENT_URL_FIELDS.map((field) => transaction[field]).filter(
    (path): path is string => !!path,
  );
}

// Deletes a transaction's uploaded documents from Storage once its deletion
// has been approved. Goes through an Edge Function (not a direct client
// .remove() call) because storage.objects has no client-facing delete RLS
// policy -- only service-role can remove objects, so the actual removal has
// to happen server-side. The function re-checks can_manage_org(orgId) itself
// using the caller's own auth before touching anything, rather than trusting
// this client to have already gated the call correctly.
export async function removeTransactionDocuments(
  orgId: string,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.functions.invoke('delete-transaction-documents', {
    body: { orgId, paths },
  });
  if (error) throw error;
}

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
