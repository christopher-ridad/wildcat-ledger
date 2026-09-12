import { useEffect, useRef, useState } from 'react';

import { supabase } from '../../../../../config/supabase';
import { fileToBase64 } from '../../../services/visionApi';
import styles from './AddTransactionForm.module.css';

interface CompletenessFlag {
  label: string;
  message: string;
  box: { normalizedVertices: { x: number; y: number }[] } | null;
}

interface W9CompletenessCheckProps {
  file: File | null;
  // Passed the stable setState function directly by the parent -- see
  // useAddTransactionForm.ts -- so this effect never needs it in its deps.
  onBlockingChange: (blocking: boolean) => void;
}

// Renders the uploaded W-9's first page with a red box over anything the
// check-w9-completeness Edge Function flags as possibly incomplete (see
// GitHub issue #29 -- currently just the signature date rule). Advisory
// only: a flag requires an explicit acknowledgment to proceed rather than
// blocking outright, and a failed check itself (network, Document AI
// down) fails open instead of trapping the whole form on an unrelated
// outage.
export const W9CompletenessCheck = ({
  file,
  onBlockingChange,
}: W9CompletenessCheckProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'idle' | 'checking' | 'done' | 'error'>('idle');
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
    setExpanded(false);
    onBlockingChange(false);
    if (!file) return;

    let cancelled = false;

    const run = async () => {
      setStatus('checking');
      try {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('No canvas to render into');
        const dims = await renderPdfPage(file, canvas);
        if (cancelled) return;

        const fileBase64 = await fileToBase64(file);
        const { data, error } = await supabase.functions.invoke('check-w9-completeness', {
          body: { fileBase64 },
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
          setStatus('error');
          onBlockingChange(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
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
          className={`${styles['wl-doc-check-canvas']} ${
            expanded ? styles['wl-doc-check-canvas--expanded'] : ''
          }`}
        />
        {status === 'checking' && (
          <div className={styles['wl-doc-check-loading']}>
            <span className={styles['wl-doc-check-spinner']} aria-hidden="true" />
            <span>Checking for common gaps…</span>
          </div>
        )}
      </div>
      {status !== 'checking' && (
        <p className={styles['wl-form-hint']}>
          {expanded
            ? 'Click the preview to shrink it back down.'
            : 'Click the preview to see it full size.'}
        </p>
      )}
      {status === 'error' && (
        <p className={styles['wl-form-hint']}>
          Couldn&apos;t run the automatic check — you can still submit as normal.
        </p>
      )}
      {status === 'done' && flags.length === 0 && (
        <p className={styles['wl-form-hint']}>✓ Looks complete.</p>
      )}
      {status === 'done' && flags.length > 0 && (
        <div className={styles['wl-form-no-receipt']}>
          {flags.map((flag) => (
            <p key={flag.label} className={styles['wl-form-no-receipt-notice']}>
              ⚠ {flag.message}
            </p>
          ))}
          <label className={styles['wl-form-checkbox']}>
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => handleAcknowledge(e.target.checked)}
            />
            <span>I&apos;ve reviewed this and it&apos;s correct as-is</span>
          </label>
        </div>
      )}
    </div>
  );
};

// pdfjs-dist is a genuinely heavy library (a few hundred KB) that's only
// ever needed for this one check -- dynamically imported so it lands in
// its own chunk instead of bloating the Dashboard's main bundle for every
// visit, regardless of whether anyone ever uploads a W-9.
async function renderPdfPage(file: File, canvas: HTMLCanvasElement) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return { width: viewport.width, height: viewport.height };
}

// Document AI's coordinates are normalized (0-1) to the page, so they
// scale to whatever size the canvas actually rendered at.
function drawFlagBoxes(
  canvas: HTMLCanvasElement,
  flags: CompletenessFlag[],
  dims: { width: number; height: number },
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3;
  for (const flag of flags) {
    if (!flag.box) continue;
    const xs = flag.box.normalizedVertices.map((v) => v.x * dims.width);
    const ys = flag.box.normalizedVertices.map((v) => v.y * dims.height);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const w = Math.max(...xs) - x;
    const h = Math.max(...ys) - y;
    ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
  }
}
