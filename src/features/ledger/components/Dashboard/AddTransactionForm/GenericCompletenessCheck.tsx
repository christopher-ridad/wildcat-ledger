import { useEffect, useRef, useState } from 'react';

import { supabase } from '../../../../../config/supabase';
import { fileToBase64 } from '../../../services/visionApi';
import styles from './AddTransactionForm.module.css';
import {
  Box,
  drawFlagBoxes,
  loadPdf,
  MAX_DOCUMENT_CHECK_FILE_BYTES,
  renderPage,
} from './documentCheckCanvas';
import { DocumentCheckStatus } from './DocumentCheckStatus';

interface CompletenessFlag {
  label: string;
  message: string;
  box: Box | null;
}

interface GenericCompletenessCheckProps {
  file: File | null;
  // Passed the stable setState function directly by the parent -- see
  // useAddTransactionForm.ts -- so this effect never needs it in its deps.
  onBlockingChange: (blocking: boolean) => void;
  // The Edge Function to invoke (e.g. 'check-contracted-services-completeness').
  functionName: string;
  // Used in messages/labels only -- e.g. "Contracted Services Form".
  docLabel: string;
  maxPages: number;
}

// A single-page, field-presence-only sibling of W9CompletenessCheck and
// RSOAgreementCompletenessCheck for the remaining document types
// (Contracted Services, Conflict of Interest, Special Pay Form). Those two
// needed bespoke client-side logic (pixel-darkness reads, position-based
// field disambiguation) calibrated against a feasibility spike; these
// forms only check a handful of uniquely-labeled text fields, so one
// generic component suffices (see each check-*-completeness/check.ts for
// exactly which fields, and why others are left unchecked).
export const GenericCompletenessCheck = ({
  file,
  onBlockingChange,
  functionName,
  docLabel,
  maxPages,
}: GenericCompletenessCheckProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'idle' | 'checking' | 'done' | 'error'>('idle');
  const genericErrorMessage =
    "Couldn't run the automatic check — you can still submit as normal.";
  const [errorMessage, setErrorMessage] = useState(genericErrorMessage);
  const [flags, setFlags] = useState<CompletenessFlag[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setFlags([]);
    setAcknowledged(false);
    setStatus('idle');
    setErrorMessage(genericErrorMessage);
    setExpanded(false);
    onBlockingChange(false);
    if (!file) return;

    if (file.size > MAX_DOCUMENT_CHECK_FILE_BYTES) {
      setErrorMessage(
        `This file is larger than expected for a ${docLabel} — skipping the automatic check.`,
      );
      setStatus('error');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      setStatus('checking');
      try {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('No canvas to render into');

        const pdf = await loadPdf(file);
        if (cancelled) return;
        if (pdf.numPages > maxPages) {
          setErrorMessage(
            `This file has more pages than expected for a ${docLabel} — skipping the automatic check.`,
          );
          setStatus('error');
          onBlockingChange(false);
          return;
        }

        const dims = await renderPage(pdf, 1, canvas);
        if (cancelled) return;

        const fileBase64 = await fileToBase64(file);
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { fileBase64 },
          signal: controller.signal,
        });
        if (cancelled) return;
        if (error) throw error;

        const detectedFlags: CompletenessFlag[] = data?.flags ?? [];
        setFlags(detectedFlags);
        drawFlagBoxes(canvas, detectedFlags, dims);
        setStatus('done');
        onBlockingChange(detectedFlags.length > 0);
      } catch {
        if (!cancelled) {
          setErrorMessage(genericErrorMessage);
          setStatus('error');
          onBlockingChange(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
      // Superseded by a newer file before this finished -- abort rather
      // than let an already-discarded check keep running (and billing) in
      // the background.
      controller.abort();
    };
    // onBlockingChange is the stable setState function from the parent's
    // useState, and functionName/docLabel/maxPages/genericErrorMessage are
    // all fixed per call site -- deliberately not in the dep array.
  }, [file]);

  const handleAcknowledge = (checked: boolean) => {
    setAcknowledged(checked);
    onBlockingChange(flags.length > 0 && !checked);
  };

  if (!file) return null;

  return (
    <div className={styles['wl-doc-check']}>
      <div
        className={styles['wl-doc-check-canvas-wrap']}
        onClick={() => status !== 'checking' && setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        aria-label={expanded ? 'Collapse preview' : 'Expand preview'}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && status !== 'checking') {
            setExpanded((v) => !v);
          }
        }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Preview of the uploaded ${docLabel}, with any flagged areas outlined in red`}
          className={`${styles['wl-doc-check-canvas']} ${
            expanded ? styles['wl-doc-check-canvas--expanded'] : ''
          }`}
        />
        {status === 'checking' && (
          <div
            className={styles['wl-doc-check-loading']}
            role="status"
            aria-live="polite"
          >
            <span className={styles['wl-doc-check-spinner']} aria-hidden="true" />
            <span>Checking for common gaps…</span>
          </div>
        )}
      </div>
      <DocumentCheckStatus
        status={status}
        expanded={expanded}
        errorMessage={errorMessage}
        flags={flags.map((f) => ({ key: f.label, message: f.message }))}
        acknowledged={acknowledged}
        onAcknowledge={handleAcknowledge}
      />
    </div>
  );
};
