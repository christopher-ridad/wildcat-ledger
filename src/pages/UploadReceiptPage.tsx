import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { supabase } from '../config/supabase';
import { documentPath, uploadDocument } from '../features/ledger/services/storage';

const FILE_TYPE_MAP: Record<string, { field: string; prefix: string; label: string }> = {
  receipt: { field: 'receiptFileUrl', prefix: 'receipt', label: 'Receipt' },
  contract: { field: 'contractFileUrl', prefix: 'contract', label: 'RSO Agreement' },
  w9: { field: 'w9FileUrl', prefix: 'w9', label: 'W-9' },
  contractedServices: {
    field: 'contractedServicesFileUrl',
    prefix: 'contractedServices',
    label: 'Contracted Services Form',
  },
  conflictOfInterest: {
    field: 'conflictOfInterestFileUrl',
    prefix: 'conflictOfInterest',
    label: 'Conflict of Interest Form',
  },
};

export const UploadReceiptPage = () => {
  const [searchParams] = useSearchParams();
  const transactionId = searchParams.get('transactionId');
  const orgId = searchParams.get('orgId');
  const token = searchParams.get('token');
  const rawFileType = searchParams.get('fileType') ?? 'receipt';
  const fileType = rawFileType in FILE_TYPE_MAP ? rawFileType : 'receipt';
  const { field, prefix, label: docLabel } = FILE_TYPE_MAP[fileType];

  const [txnTitle, setTxnTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!transactionId || !orgId || !token) {
      setLoadError('Invalid link — missing transaction, organization, or token.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_transaction_title', {
          p_org_id: orgId,
          p_transaction_id: transactionId,
        });
        if (error || !data) {
          setLoadError('Transaction not found.');
        } else {
          setTxnTitle(data as string);
        }
      } catch {
        setLoadError('Failed to load transaction details.');
      } finally {
        setLoading(false);
      }
    })();
  }, [transactionId, orgId, token]);

  const handleUpload = async () => {
    if (!file || !transactionId || !orgId || !token) return;
    setUploading(true);
    setUploadError(null);
    try {
      const path = documentPath(orgId, transactionId, file, prefix);
      await uploadDocument(path, file);
      const { error } = await supabase.rpc('submit_document_upload', {
        p_org_id: orgId,
        p_transaction_id: transactionId,
        p_field: field,
        p_token: token,
        p_url: path,
      });
      if (error) throw error;
      setSuccess(true);
    } catch {
      setUploadError('Upload failed. The link may have expired or already been used.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="wl-upload-receipt-root">
        <div className="wl-upload-receipt-card">
          <p className="wl-upload-receipt-txn">Loading…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="wl-upload-receipt-root">
        <div className="wl-upload-receipt-card">
          <h1 className="wl-upload-receipt-title">Upload {docLabel}</h1>
          <p className="wl-form-error">{loadError}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="wl-upload-receipt-root">
        <div className="wl-upload-receipt-card">
          <h1 className="wl-upload-receipt-title">Done!</h1>
          <p className="wl-upload-receipt-success">
            Your {docLabel} has been uploaded successfully.
          </p>
          <p className="wl-upload-receipt-txn">You can close this tab.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wl-upload-receipt-root">
      <div className="wl-upload-receipt-card">
        <h1 className="wl-upload-receipt-title">Upload {docLabel}</h1>
        {txnTitle && (
          <p className="wl-upload-receipt-txn">
            Transaction: <strong>{txnTitle}</strong>
          </p>
        )}
        <div className="wl-form-group">
          <label className="wl-form-label" htmlFor="upload-doc-file">
            {docLabel} (photo or PDF)
          </label>
          <input
            id="upload-doc-file"
            type="file"
            accept="image/*,application/pdf"
            className="wl-form-file"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setUploadError(null);
            }}
          />
        </div>
        {uploadError && (
          <div className="wl-form-error" role="alert">
            {uploadError}
          </div>
        )}
        <button
          type="button"
          className="wl-btn-primary"
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? 'Uploading…' : `Upload ${docLabel}`}
        </button>
      </div>
    </div>
  );
};
