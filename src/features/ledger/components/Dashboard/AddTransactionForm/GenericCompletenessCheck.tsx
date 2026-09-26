import { useEffect, useRef, useState } from 'react';

import { supabase } from '../../../../../config/supabase';
import { fileToBase64 } from '../../../services/visionApi';
import styles from './AddTransactionForm.module.css';
import { Box, drawFlagBoxes, MAX_DOCUMENT_CHECK_FILE_BYTES } from './documentCheckCanvas';
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
// RSOAgreementCompletenessCheck for the remaining checked document types
// (Contracted Services Form, Conflict of Interest Form, Special Pay Form).
// Those two earlier checks each needed bespoke client-side logic -- reading
// checkbox darkness directly off pixels, disambiguating duplicate field
// labels by page position -- calibrated against real Document AI output
// from a feasibility spike. The forms this component covers don't get that
// same treatment: each one only checks a handful of uniquely-labeled text
// fields (see each check-*-completeness/check.ts's own header comment for
// exactly which, and why some visible fields on the form are deliberately
// left unchecked -- ambiguous or repeated labels, checkbox grids, etc that
// would need the same kind of calibration this component's siblings had
// and this didn't). Still genuinely useful, just narrower in scope.
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

        const dims = await renderPage(pdf, canvas);
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

// pdfjs-dist is only ever needed for these checks, so it's dynamically
// imported to keep it out of the Dashboard's main bundle -- same reasoning
// as W9CompletenessCheck's loadPdf. Only page 1 is ever rendered/checked,
// regardless of how many pages the upload has (see each doc's maxPages
// comment above for why that's still a meaningful cap).
async function loadPdf(file: File) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  return pdfjsLib.getDocument({ data: buffer }).promise;
}

async function renderPage(
  pdf: Awaited<ReturnType<typeof loadPdf>>,
  canvas: HTMLCanvasElement,
) {
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return { width: viewport.width, height: viewport.height };
}
