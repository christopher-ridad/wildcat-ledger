import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  titleId: string;
  title: ReactNode;
  className?: string;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shared shell for every modal in the app: overlay + Escape-to-close +
// header/close-button + body. Previously hand-rolled once per modal, which
// let them drift out of sync -- one had no Escape handler at all, and used
// a different close icon and overlay pattern than the other three.
//
// Also owns the WAI-ARIA dialog pattern's focus behavior, not caught by
// this app's own axe-core e2e scans -- those check the dialog's static
// rendered state, not whether focus actually moves there: on open, focus
// moves into the dialog (and back to whatever triggered it on close), and
// Tab/Shift+Tab is trapped to the dialog's own focusable elements rather
// than escaping into the (visually hidden-behind-the-overlay, but
// otherwise still normally focusable) page behind it.
export const Modal = ({
  isOpen,
  onClose,
  titleId,
  title,
  className,
  children,
}: ModalProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // Consumers pass onClose inline (`onClose={() => setOpen(false)}`), a new
  // function every render -- reading it via ref keeps the effect below from
  // re-running (and re-capturing/restoring focus) on every parent re-render
  // while the modal stays open, only on isOpen actually flipping.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      // Also wrap when focus is on the dialog container itself (its
      // initial-focus target, not in `focusable`) -- Shift+Tab from there
      // should land on `last`, same as from `first`.
      const onFirstOrContainer =
        document.activeElement === first || document.activeElement === dialogRef.current;
      if (e.shiftKey && onFirstOrContainer) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="wl-modal-root">
      <div
        className="wl-modal-overlay"
        role="button"
        tabIndex={0}
        aria-label="Close"
        onClick={onClose}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClose()}
      />
      <div
        ref={dialogRef}
        className={className ? `wl-modal ${className}` : 'wl-modal'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="wl-modal-header">
          <h2 id={titleId} className="wl-modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="wl-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div className="wl-modal-body">{children}</div>
      </div>
    </div>
  );
};
