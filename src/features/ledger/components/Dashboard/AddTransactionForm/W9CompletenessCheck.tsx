import { useEffect, useRef, useState } from 'react';

import { supabase } from '../../../../../config/supabase';
import { fileToBase64 } from '../../../services/visionApi';
import styles from './AddTransactionForm.module.css';
import {
  Box,
  drawFlagBoxes,
  MAX_DOCUMENT_CHECK_FILE_BYTES,
  MAX_DOCUMENT_CHECK_PAGES,
} from './documentCheckCanvas';
import { DocumentCheckStatus } from './DocumentCheckStatus';

interface CompletenessFlag {
  label: string;
  message: string;
  box: Box | null;
}

const GENERIC_ERROR_MESSAGE =
  "Couldn't run the automatic check — you can still submit as normal.";
const TOO_LARGE_MESSAGE =
  'This file is larger than expected for a W-9 — skipping the automatic check.';
const TOO_MANY_PAGES_MESSAGE =
  'This file has more pages than expected for a W-9 — skipping the automatic check.';

interface W9CompletenessCheckProps {
  file: File | null;
  // Passed the stable setState function directly by the parent -- see
  // useAddTransactionForm.ts -- so this effect never needs it in its deps.
  onBlockingChange: (blocking: boolean) => void;
}

// Renders the uploaded W-9's first page with a red box over anything the
// check-w9-completeness Edge Function flags as possibly incomplete.
// Advisory only: a flag requires an explicit acknowledgment to proceed
// rather than blocking outright, and a failed check itself (network,
// Document AI down) fails open instead of trapping the whole form on an
// unrelated outage.
export const W9CompletenessCheck = ({
  file,
  onBlockingChange,
}: W9CompletenessCheckProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'idle' | 'checking' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState(GENERIC_ERROR_MESSAGE);
  const [flags, setFlags] = useState<CompletenessFlag[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  // The rendered page is compact by default (it's a full document, most
  // of it isn't relevant to a couple of flags) -- click it to see the
  // whole thing at full size.
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setFlags([]);
    setAcknowledged(false);
    setStatus('idle');
    setErrorMessage(GENERIC_ERROR_MESSAGE);
    setExpanded(false);
    onBlockingChange(false);
    if (!file) return;

    if (file.size > MAX_DOCUMENT_CHECK_FILE_BYTES) {
      setErrorMessage(TOO_LARGE_MESSAGE);
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
        if (pdf.numPages > MAX_DOCUMENT_CHECK_PAGES) {
          setErrorMessage(TOO_MANY_PAGES_MESSAGE);
          setStatus('error');
          onBlockingChange(false);
          return;
        }

        const dims = await renderPage(pdf, canvas);
        if (cancelled) return;

        const fileBase64 = await fileToBase64(file);
        const { data, error } = await supabase.functions.invoke('check-w9-completeness', {
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
          setErrorMessage(GENERIC_ERROR_MESSAGE);
          setStatus('error');
          onBlockingChange(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
      // Superseded by a newer file before this finished -- abort rather
      // than let an already-discarded check keep running (and billing)
      // in the background.
      controller.abort();
    };
    // onBlockingChange is the stable setState function from the parent's
    // useState -- deliberately not in the dep array, it never changes.
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
          aria-label="Preview of the uploaded W-9, with any flagged areas outlined in red"
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

// pdfjs-dist is a genuinely heavy library (a few hundred KB) that's only
// ever needed for this one check -- dynamically imported so it lands in
// its own chunk instead of bloating the Dashboard's main bundle for every
// visit, regardless of whether anyone ever uploads a W-9. Split into
// load/render so the page count is known (and can be rejected) before
// ever rendering anything.
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
