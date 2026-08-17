import { useState } from 'react';

import { getErrorMessage } from '../../../utils/errors';

// Shared by the several places that otherwise hand-rolled their own
// pending/error state around a single async action: set pending, clear the
// previous error, await the action, capture a thrown Error's message (or
// fall back), then clear pending.
export function useAsyncAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (
    fn: () => Promise<void>,
    fallbackMessage = 'Something went wrong.',
  ) => {
    setPending(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(getErrorMessage(err, fallbackMessage));
    } finally {
      setPending(false);
    }
  };

  return { pending, error, setError, run };
}

// Same shape as useAsyncAction, but tracks pending/error per key -- for
// actions that can be in flight for several items at once (e.g. one row per
// transaction), where a single pending/error pair would clobber across rows.
export function useAsyncActionMap() {
  const [pendingMap, setPendingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});

  const run = async (
    key: string,
    fn: () => Promise<void>,
    fallbackMessage = 'Something went wrong.',
  ) => {
    setPendingMap((prev) => ({ ...prev, [key]: true }));
    setErrorMap((prev) => ({ ...prev, [key]: '' }));
    try {
      await fn();
    } catch (err) {
      setErrorMap((prev) => ({
        ...prev,
        [key]: getErrorMessage(err, fallbackMessage),
      }));
    } finally {
      setPendingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const reset = () => {
    setPendingMap({});
    setErrorMap({});
  };

  return {
    pending: (key: string) => !!pendingMap[key],
    error: (key: string) => errorMap[key] || '',
    run,
    reset,
  };
}
