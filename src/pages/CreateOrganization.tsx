import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { BudgetAllocationForm } from '../features/ledger/components/CreateOrganization/BudgetAllocationForm';
import {
  BudgetUploadArea,
  ScanState,
} from '../features/ledger/components/CreateOrganization/BudgetUploadArea';
import { useLedger } from '../features/ledger/hooks/useLedger';
import { parseBudgetAllocation } from '../features/ledger/services/parseBudgetAllocation';
import { BudgetAllocations } from '../features/ledger/types';
import { TopNav } from '../layouts/TopNav';

const EMPTY_ALLOCATIONS: BudgetAllocations = {
  ASG: 0,
  Operating: 0,
  Gifts: 0,
  'Debit Card': 0,
};

export const CreateOrganization = () => {
  const { activeOrganization, initializeBudgetAllocations } = useLedger();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [allocations, setAllocations] = useState<BudgetAllocations>(EMPTY_ALLOCATIONS);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanError, setScanError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!activeOrganization) {
      navigate('/organizations', { replace: true });
      return;
    }
    if (activeOrganization.isBudgetLinesSet) {
      navigate('/dashboard', { replace: true });
    }
  }, [activeOrganization, navigate]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const pdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    setIsPdf(pdf);
    setUploadedFileName(file.name);
    setPreviewUrl(pdf ? null : URL.createObjectURL(file));
    setScanState('scanning');
    setScanError(null);
    setError(null);

    try {
      const result = await parseBudgetAllocation(file);
      setAllocations({
        ASG: result.ASG,
        Operating: result.Operating,
        Gifts: result.Gifts,
        'Debit Card': 0,
      });
      setScanState('done');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed');
      setScanState('error');
    }
  };

  const updateLine = (line: keyof Omit<BudgetAllocations, 'Debit Card'>, raw: string) => {
    if (!/^\d*\.?\d{0,2}$/.test(raw)) return;
    const val = parseFloat(raw);
    setAllocations((prev) => ({ ...prev, [line]: isNaN(val) ? 0 : val }));
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await initializeBudgetAllocations(allocations);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Failed to save budget allocations. Please try again.');
      setSubmitting(false);
    }
  };

  if (!activeOrganization) return null;

  return (
    <div className="wl-register-root wl-topnav-offset">
      <TopNav />
      <div className="wl-register-card">
        <h1 className="wl-register-title">{activeOrganization.name}</h1>
        <p className="wl-register-subtitle">
          Upload your budget allocation document to get started.
        </p>

        <BudgetUploadArea
          scanState={scanState}
          scanError={scanError}
          isPdf={isPdf}
          previewUrl={previewUrl}
          uploadedFileName={uploadedFileName}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
        />

        {(scanState === 'done' || scanState === 'error') && (
          <BudgetAllocationForm
            allocations={allocations}
            isScanned={scanState === 'done'}
            onLineChange={updateLine}
          />
        )}

        {error && (
          <div className="wl-form-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        {(scanState === 'done' || scanState === 'error') && (
          <button
            type="button"
            className="wl-btn-primary wl-register-done"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Save & Continue'}
          </button>
        )}

        {(scanState === 'done' || scanState === 'error') && (
          <button
            type="button"
            className="wl-btn-secondary"
            style={{ marginTop: 8 }}
            onClick={() => {
              setPreviewUrl(null);
              setUploadedFileName(null);
              setIsPdf(false);
              setScanState('idle');
              setAllocations(EMPTY_ALLOCATIONS);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          >
            Upload a different image
          </button>
        )}
      </div>
    </div>
  );
};
