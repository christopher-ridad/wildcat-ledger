import { useEffect, useRef } from 'react';

// Runs `onOpen` only on the false->true transition of `isOpen`, not on every
// re-render while it stays open. Shared by modals that reset local form
// state when opened but must NOT clobber in-progress edits when their data
// refreshes via Realtime while already open (see ReconciliationModal and
// DebitCardSettingsModal).
export function useResetOnOpen(
  isOpen: boolean,
  onOpen: () => void,
  extraDeps: unknown[] = [],
) {
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      onOpen();
    }
    wasOpenRef.current = isOpen;
    // onOpen is provided fresh by the caller each render; extraDeps carries
    // the values it actually closes over.
  }, [isOpen, ...extraDeps]);
}
