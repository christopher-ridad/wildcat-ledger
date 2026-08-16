import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  titleId: string;
  title: ReactNode;
  className?: string;
  children: ReactNode;
}

// Shared shell for every modal in the app: overlay + Escape-to-close +
// header/close-button + body. Previously hand-rolled once per modal, which
// let them drift out of sync -- one had no Escape handler at all, and used
// a different close icon and overlay pattern than the other three.
export const Modal = ({
  isOpen,
  onClose,
  titleId,
  title,
  className,
  children,
}: ModalProps) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

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
        className={className ? `wl-modal ${className}` : 'wl-modal'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
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
