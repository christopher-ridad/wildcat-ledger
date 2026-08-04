import { useEffect, useState } from 'react';

import { getSignedFileUrl } from '../../../services/storage';
import { Transaction } from '../../../types';
import styles from './TransactionFilesModal.module.css';

const FILE_LABELS: { key: keyof Transaction; label: string }[] = [
  { key: 'receiptFileUrl', label: 'Receipt' },
  { key: 'contractFileUrl', label: 'RSO Agreement / Contract' },
  { key: 'w9FileUrl', label: 'W-9 Form' },
  { key: 'contractedServicesFileUrl', label: 'Contracted Services Form' },
  { key: 'conflictOfInterestFileUrl', label: 'Conflict of Interest Form' },
];

export const getTransactionFiles = (t: Transaction) =>
  FILE_LABELS.flatMap(({ key, label }) => {
    const url = t[key];
    return typeof url === 'string' ? [{ label, url }] : [];
  });

const FilePreviewCard = ({ label, url: path }: { label: string; url: string }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSignedFileUrl(path)
      .then((url) => {
        if (!cancelled) setSignedUrl(url);
      })
      .catch(() => {
        if (!cancelled) setImgFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <div className={styles['wl-file-card']}>
      <div className={styles['wl-file-card-label']}>{label}</div>
      {!imgFailed && signedUrl ? (
        <img
          src={signedUrl}
          alt={label}
          className={styles['wl-file-preview-img']}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className={styles['wl-file-pdf-placeholder']}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </svg>
          <span>PDF Document</span>
        </div>
      )}
      {signedUrl && (
        <a
          href={signedUrl}
          target="_blank"
          rel="noreferrer"
          className={styles['wl-file-open-link']}
        >
          Open in new tab ↗
        </a>
      )}
    </div>
  );
};

export const TransactionFilesModal = ({
  transaction,
  onClose,
}: {
  transaction: Transaction;
  onClose: () => void;
}) => {
  const files = getTransactionFiles(transaction);

  return (
    <div className="wl-modal-root" role="dialog" aria-modal="true">
      <div
        className="wl-modal-overlay"
        role="button"
        tabIndex={0}
        aria-label="Close"
        onClick={onClose}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClose()}
      />
      <div className={`wl-modal ${styles['wl-files-modal']}`}>
        <div className="wl-modal-header">
          <h2 className="wl-modal-title">Attachments — {transaction.title}</h2>
          <button className="wl-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="wl-modal-body">
          {files.length === 0 ? (
            <p className={styles['wl-files-empty']}>
              No files attached to this transaction.
            </p>
          ) : (
            <div className={styles['wl-files-grid']}>
              {files.map(({ label, url }) => (
                <FilePreviewCard key={label} label={label} url={url} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
