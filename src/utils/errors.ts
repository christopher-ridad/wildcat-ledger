// Supabase's PostgrestError (returned by every failed .rpc()/.from() call)
// is declared as `class PostgrestError extends Error` in its own source,
// but what actually reaches a catch block here is a plain
// `{ message, details, hint, code }` object -- not a real Error instance
// -- so `err instanceof Error` is always false for it. Every catch block
// using that check to decide whether to show `err.message` was silently
// falling back to a generic message for every Supabase-originated error.
// Confirmed directly against a local Supabase instance while adding e2e
// tests; invisible to the unit-test suite since mocked rejections there
// are always real `new Error(...)` instances.
export const getErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error) return err.message;
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
};
