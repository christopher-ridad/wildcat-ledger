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
import { EMPTY_ALLOCATIONS } from '../features/ledger/utils/constants';
import { TopNav } from '../layouts/TopNav';
import { getErrorMessage } from '../utils/errors';

export const CreateOrganization = () => {
  const {
    activeOrganization,
    initializeBudgetAllocations,
    loading,
    canEdit,
    peopleNames,
  } = useLedger();
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
  // Set once a save has gone through, so the effect below knows a stalled
  // isBudgetLinesSet is worth warning about instead of just "not there yet".
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!activeOrganization) {
      navigate('/organizations', { replace: true });
      return;
    }
    if (activeOrganization.isBudgetLinesSet) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, activeOrganization, navigate]);

  // The save itself only confirms the database write; activeOrganization
  // (and the redirect above) only updates once Realtime delivers that
  // change back to this client. Normally near-instant, but if it stalls --
  // a slow reconnect, a dropped websocket -- the effect above never fires
  // and this button would otherwise sit on "Saving…" forever with no
  // explanation. This is also why handleSubmit doesn't navigate directly:
  // doing so would race ahead of that Realtime update and land on the
  // Dashboard while it's still reading the pre-save org (all budget lines
  // at $0).
  useEffect(() => {
    if (!awaitingConfirmation) return;
    const timeout = window.setTimeout(() => {
      setError(
        "This is taking longer than expected. Your budget was saved, but the page hasn't " +
          'picked it up yet -- try refreshing.',
      );
      setAwaitingConfirmation(false);
      setSubmitting(false);
    }, 10_000);
    return () => window.clearTimeout(timeout);
  }, [awaitingConfirmation]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      setScanError(getErrorMessage(err, 'Scan failed'));
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
      // Deliberately not navigating here -- see the effects above. The
      // resolved promise only confirms the write landed in the database,
      // not that this client's own organizations state (Realtime-sourced)
      // has caught up yet, and navigating on that assumption is what used
      // to send the Dashboard to a stale, all-zero version of the org.
      setAwaitingConfirmation(true);
    } catch (err) {
      setError(
        getErrorMessage(err, 'Failed to save budget allocations. Please try again.'),
      );
      setSubmitting(false);
    }
  };

  if (!activeOrganization) return null;

  // Only a SOFO Approver can set the initial budget (initializeBudgetAllocations
  // is rejected server-side otherwise -- see the "managers can update their
  // org" RLS policy). Checked here too, up front, so an Officer doesn't
  // upload and scan a document only to hit that failure at save time --
  // this is exactly what happened live: someone was listed as an Officer,
  // not a SOFO Approver, and only found out after the scan succeeded.
  if (!canEdit) {
    const displayName = (email: string) => peopleNames[email] ?? email;
    return (
      <div className="wl-register-root wl-topnav-offset">
        <TopNav />
        <div className="wl-register-card">
          <h1 className="wl-register-title">{activeOrganization.name}</h1>
          <p className="wl-register-subtitle">
            Only a SOFO Approver can set up this organization&apos;s initial budget.
          </p>
          <div className="wl-form-error" style={{ marginTop: 12 }}>
            Ask a SOFO Approver to complete this step:{' '}
            {activeOrganization.sofoApprovers.map(displayName).join(', ') ||
              'none listed for this organization yet -- contact an administrator.'}
          </div>
        </div>
      </div>
    );
  }

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
