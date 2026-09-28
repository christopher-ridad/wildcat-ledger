// Every completeness-check component (GenericCompletenessCheck,
// W9CompletenessCheck, RSOAgreementCompletenessCheck) invoked
// supabase.functions.invoke the exact same way -- a document's base64
// content in, that Edge Function's raw JSON response out. Pulled out so
// none of those presentation components talk to Supabase directly, the
// same reasoning storage.ts and visionApi.ts already keep API calls out of
// components elsewhere in this feature.
import { supabase } from '../../../config/supabase';
import { Box } from '../components/Dashboard/AddTransactionForm/documentCheckCanvas';

export interface CompletenessFlag {
  label: string;
  message: string;
  box: Box | null;
}

// Response shape differs per check -- most forms return a flat
// CompletenessFlag[], but RSO Agreement's own richer per-page shape
// (RsoCheckResult in RSOAgreementCompletenessCheck.tsx) doesn't fit that,
// so this stays generic over the response rather than assuming everyone
// wants `.flags`.
export async function invokeDocumentCheck<T>(
  functionName: string,
  fileBase64: string,
  signal: AbortSignal,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { fileBase64 },
    signal,
  });
  if (error) throw error;
  return data as T;
}

export async function checkDocumentCompleteness(
  functionName: string,
  fileBase64: string,
  signal: AbortSignal,
): Promise<CompletenessFlag[]> {
  const data = await invokeDocumentCheck<{ flags?: CompletenessFlag[] }>(
    functionName,
    fileBase64,
    signal,
  );
  return data?.flags ?? [];
}
