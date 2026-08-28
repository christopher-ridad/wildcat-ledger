import type { ChangeEvent, RefObject } from 'react';

import styles from './BudgetUploadArea.module.css';

export type ScanState = 'idle' | 'scanning' | 'done' | 'error';

interface BudgetUploadAreaProps {
  scanState: ScanState;
  scanError: string | null;
  isPdf: boolean;
  previewUrl: string | null;
  uploadedFileName: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export const BudgetUploadArea = ({
  scanState,
  scanError,
  isPdf,
  previewUrl,
  uploadedFileName,
  fileInputRef,
  onFileChange,
}: BudgetUploadAreaProps) => (
  <>
    <div
      className={`${styles['wl-budget-upload-area']} ${scanState === 'scanning' ? styles['wl-budget-upload-scanning'] : ''}`}
      onClick={() => fileInputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />

      {scanState === 'scanning' ? (
        <div className={styles['wl-budget-upload-placeholder']}>
          <span className={styles['wl-budget-upload-icon']}>⏳</span>
          <span className="wl-ocr-scanning">Scanning document…</span>
        </div>
      ) : previewUrl && !isPdf ? (
        <img
          src={previewUrl}
          alt="Budget document"
          className={styles['wl-budget-upload-preview']}
        />
      ) : isPdf && uploadedFileName && scanState !== 'idle' ? (
        <div className={styles['wl-budget-upload-placeholder']}>
          <span className={styles['wl-budget-upload-icon']}>📑</span>
          <span className={styles['wl-budget-upload-filename']}>{uploadedFileName}</span>
        </div>
      ) : (
        <div className={styles['wl-budget-upload-placeholder']}>
          <span className={styles['wl-budget-upload-icon']}>📄</span>
          <span>Click to upload budget document</span>
          <span className={styles['wl-budget-upload-hint']}>Image or PDF</span>
        </div>
      )}
    </div>

    {scanState === 'error' && (
      <div className="wl-form-error" style={{ marginTop: 8 }}>
        {scanError} You can enter amounts manually below.
      </div>
    )}
  </>
);
