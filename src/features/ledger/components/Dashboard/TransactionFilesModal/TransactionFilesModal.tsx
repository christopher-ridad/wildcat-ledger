import { useEffect, useState } from 'react';

import { getErrorMessage } from '../../../../../utils/errors';
import { useLedger } from '../../../hooks/useLedger';
import { getSignedFileUrl } from '../../../services/storage';
import { Transaction } from '../../../types';
import {
  DocumentRequirement,
  getMissingDocuments,
} from '../../../utils/documentRequirements';
import { Modal } from '../Modal';
import styles from './TransactionFilesModal.module.css';

const FILE_LABELS: { key: keyof Transaction; label: string }[] = [
  { key: 'receiptFileUrl', label: 'Receipt' },
  { key: 'exemptionFormUrl', label: 'Policy Exemption Form' },
  { key: 'contractFileUrl', label: 'RSO Agreement / Contract' },
  { key: 'w9FileUrl', label: 'W-9 Form' },
  { key: 'contractedServicesFileUrl', label: 'Contracted Services Form' },
  { key: 'conflictOfInterestFileUrl', label: 'Conflict of Interest Form' },
  { key: 'specialPayFormUrl', label: 'Special Pay Form' },
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

const REQUEST_BUTTON_LABEL: Record<'simple' | 'prepareFirst', string> = {
  simple: 'Request via Email',
  prepareFirst: 'Send for Signature',
};

export const TransactionFilesModal = ({
  transaction,
  onClose,
}: {
  transaction: Transaction;
  onClose: () => void;
}) => {
  const { activeOrganizationId, requestTransactionDocument } = useLedger();
  const files = getTransactionFiles(transaction);
  const missingDocs = getMissingDocuments(transaction);
  const [justRequested, setJustRequested] = useState<Set<string>>(new Set());
  const [requesting, setRequesting] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const isRequested = (key: string) =>
    justRequested.has(key) || !!transaction.uploadTokens?.[key];

  const handleRequest = async (doc: DocumentRequirement) => {
    setRequesting(doc.key);
    setRequestError(null);
    try {
      const token = await requestTransactionDocument(transaction.id, doc.key);
      const uploadUrl = `${window.location.origin}/upload-document?transactionId=${transaction.id}&orgId=${encodeURIComponent(activeOrganizationId ?? '')}&fileType=${doc.key}&token=${token}`;
      const isSignature = doc.requestBehavior === 'prepareFirst';
      // The blank-template link is only useful to a recipient filling the
      // form out themselves for the first time -- for a signature request,
      // they're receiving the org's already-filled-in copy, not a blank one.
      const templateLine =
        doc.templatePath && !isSignature
          ? `\n\nYou can download a blank ${doc.label} here:\n${window.location.origin}${doc.templatePath}`
          : '';
      const subject = encodeURIComponent(
        `${isSignature ? 'Signature Request' : 'Document Request'}: ${doc.label} for "${transaction.title}"`,
      );
      const body = encodeURIComponent(
        isSignature
          ? `Hi,\n\nPlease review, sign, and return the attached ${doc.label} for "${transaction.title}". You can upload the signed copy here:\n\n${uploadUrl}\n\n(Don't forget to attach your filled-in copy to this email before sending!)\n\nThank you!`
          : `Hi,\n\nPlease upload the ${doc.label} for "${transaction.title}" using this link:\n\n${uploadUrl}${templateLine}\n\nThank you!`,
      );
      window.open(
        `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`,
        '_blank',
      );
      setJustRequested((prev) => new Set(prev).add(doc.key));
    } catch (err) {
      setRequestError(getErrorMessage(err, 'Failed to send the document request.'));
    } finally {
      setRequesting(null);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      titleId="files-modal-title"
      title={`Documents: ${transaction.title}`}
      className={styles['wl-files-modal']}
    >
      {missingDocs.length > 0 && (
        <div className={styles['wl-missing-docs-section']}>
          <h3 className={styles['wl-files-section-title']}>Missing</h3>
          {requestError && (
            <div className="wl-form-error" role="alert">
              {requestError}
            </div>
          )}
          <ul className={styles['wl-missing-docs-list']}>
            {missingDocs.map((doc) => (
              <li key={doc.key} className={styles['wl-missing-doc-item']}>
                <div className={styles['wl-missing-doc-header']}>
                  <span className={styles['wl-missing-doc-label']}>{doc.label}</span>
                  {doc.templatePath && (
                    <a
                      href={doc.templatePath}
                      target="_blank"
                      rel="noreferrer"
                      className={styles['wl-missing-doc-template-link']}
                    >
                      ↓ Blank {doc.label}
                    </a>
                  )}
                </div>
                {doc.requestBehavior === 'prepareFirst' && (
                  <p className={styles['wl-missing-doc-hint']}>
                    Download the template, fill in your org&apos;s details, and attach
                    your version to the email before sending. A mailto link can&apos;t
                    attach it for you.
                  </p>
                )}
                {doc.requestBehavior === 'none' ? (
                  <p className={styles['wl-missing-doc-hint']}>
                    Nobody else needs to fill this out. Complete and upload it yourself.
                  </p>
                ) : (
                  <div className={styles['wl-missing-doc-actions']}>
                    <button
                      type="button"
                      className={styles['wl-btn-request-doc']}
                      disabled={requesting === doc.key}
                      onClick={() => handleRequest(doc)}
                    >
                      {requesting === doc.key
                        ? 'Sending…'
                        : REQUEST_BUTTON_LABEL[doc.requestBehavior]}
                    </button>
                    {isRequested(doc.key) && (
                      <span className={styles['wl-missing-doc-requested-note']}>
                        Requested, waiting for upload
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {files.length === 0 ? (
        <p className={styles['wl-files-empty']}>No files attached to this transaction.</p>
      ) : (
        <>
          {missingDocs.length > 0 && (
            <h3 className={styles['wl-files-section-title']}>Attached</h3>
          )}
          <div className={styles['wl-files-grid']}>
            {files.map(({ label, url }) => (
              <FilePreviewCard key={label} label={label} url={url} />
            ))}
          </div>
        </>
      )}
    </Modal>
  );
};
