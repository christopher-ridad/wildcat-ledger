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

const GENERIC_ERROR_MESSAGE =
  "Couldn't run the automatic check — you can still submit as normal.";
const TOO_LARGE_MESSAGE =
  'This file is larger than expected for an RSO Agreement — skipping the automatic check.';
const TOO_MANY_PAGES_MESSAGE =
  'This file has more pages than expected for an RSO Agreement — skipping the automatic check.';

interface SectionFlag {
  section: number;
  page: number;
  message: string;
  box: Box;
}

interface Section4Row {
  key: string;
  label: string;
  page: number;
  yesBox: Box;
  noBox: Box;
}

interface ReservationSubsection {
  filled: boolean;
  page: number;
  box: Box;
}

interface RsoCheckResult {
  sectionFlags: SectionFlag[];
  section4Box: { page: number; box: Box };
  section4Rows: Section4Row[];
  reservationSubsection: ReservationSubsection;
}

interface DisplayFlag {
  key: string;
  message: string;
  page: number;
  box: Box | null;
}

interface RowAnswer {
  key: string;
  answer: 'yes' | 'no' | 'unanswered';
}

// Turns the server's section-level flags plus this component's own
// pixel-read Section 4 answers into one combined, page-tagged flag list.
// Pure and DOM-free -- the only part of this check with real conditional
// logic, kept separate from the canvas/network plumbing that surrounds
// it in the effect below.
export function deriveFlags(
  result: RsoCheckResult,
  rowAnswers: RowAnswer[],
): DisplayFlag[] {
  const sectionFlags: DisplayFlag[] = result.sectionFlags.map((f) => ({
    key: `section-${f.section}`,
    message: f.message,
    page: f.page,
    box: f.box,
  }));

  if (rowAnswers.some((r) => r.answer === 'unanswered')) {
    return [
      ...sectionFlags,
      {
        key: 'section-4',
        message: 'Section 4 not filled out.',
        page: result.section4Box.page,
        box: result.section4Box.box,
      },
    ];
  }

  const rowB = rowAnswers.find((r) => r.key === 'b');
  if (rowB?.answer === 'yes' && !result.reservationSubsection.filled) {
    return [
      ...sectionFlags,
      {
        key: 'section-4b',
        message:
          'Section 4 needs the reservation details (space reserved and event contact) filled out since you selected Yes for reserved space.',
        page: result.reservationSubsection.page,
        box: result.reservationSubsection.box,
      },
    ];
  }

  return sectionFlags;
}

interface RSOAgreementCompletenessCheckProps {
  file: File | null;
  // Passed the stable setState function directly by the parent, same
  // convention as W9CompletenessCheck -- deliberately not in the effect's
  // deps, it never changes.
  onBlockingChange: (blocking: boolean) => void;
}

// Renders both pages of the uploaded RSO Agreement with red boxes over
// anything the check-rso-agreement-completeness Edge Function flags as
// possibly incomplete. Unlike the W-9 check, flags here are section-level
// ("Section 1 not filled out") rather than per-field, matching the
// requested UX.
//
// Section 4's seven Yes/No rows are a special case: Document AI's own
// checkbox detection only reliably covers 4 of the 7 rows (a confirmed
// processor limitation, not a resolution issue -- see the Edge Function's
// header comment), so the server instead returns each row's calibrated
// circle position and this component reads the actual pixel darkness of
// each one via canvas.getImageData() to determine which side (if either)
// is filled in. Row b's conditional subsection is checked the same way
// the server checks everything else non-visual: text presence in a known
// region.
export const RSOAgreementCompletenessCheck = ({
  file,
  onBlockingChange,
}: RSOAgreementCompletenessCheckProps) => {
  const canvasRefs = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)];
  const [status, setStatus] = useState<'idle' | 'checking' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState(GENERIC_ERROR_MESSAGE);
  const [flags, setFlags] = useState<DisplayFlag[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
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
        const [canvas1, canvas2] = canvasRefs.map((r) => r.current);
        if (!canvas1 || !canvas2) throw new Error('No canvas to render into');

        const pdf = await loadPdf(file);
        if (cancelled) return;
        if (pdf.numPages > MAX_DOCUMENT_CHECK_PAGES) {
          setErrorMessage(TOO_MANY_PAGES_MESSAGE);
          setStatus('error');
          onBlockingChange(false);
          return;
        }

        const [dims1, dims2] = await Promise.all([
          renderPage(pdf, 1, canvas1),
          renderPage(pdf, 2, canvas2),
        ]);
        if (cancelled) return;

        const fileBase64 = await fileToBase64(file);
        const { data, error } = await supabase.functions.invoke(
          'check-rso-agreement-completeness',
          {
            body: { fileBase64 },
            signal: controller.signal,
          },
        );
        if (cancelled) return;
        if (error) throw error;

        const result = data as RsoCheckResult;
        const dimsByPage = [dims1, dims2];
        const ctx2 = canvas2.getContext('2d');

        const rowAnswers: RowAnswer[] = ctx2
          ? result.section4Rows.map((row) => ({
              key: row.key,
              answer: readRowAnswer(ctx2, row, dimsByPage[row.page]),
            }))
          : [];

        const allFlags = deriveFlags(result, rowAnswers);

        setFlags(allFlags);
        drawFlagBoxes(
          canvas1,
          allFlags.filter((f) => f.page === 0),
          dims1,
        );
        drawFlagBoxes(
          canvas2,
          allFlags.filter((f) => f.page === 1),
          dims2,
        );
        setStatus('done');
        onBlockingChange(allFlags.length > 0);
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
        className={styles['wl-doc-check-pages']}
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
        {canvasRefs.map((ref, i) => (
          <div key={i} className={styles['wl-doc-check-canvas-wrap']}>
            <canvas
              ref={ref}
              role="img"
              aria-label={`Preview of RSO Agreement page ${i + 1}, with any flagged areas outlined in red`}
              className={`${styles['wl-doc-check-canvas']} ${
                expanded ? styles['wl-doc-check-canvas--expanded'] : ''
              }`}
            />
            {status === 'checking' && (
              <div
                className={styles['wl-doc-check-loading']}
                role={i === 0 ? 'status' : undefined}
                aria-live={i === 0 ? 'polite' : undefined}
              >
                <span className={styles['wl-doc-check-spinner']} aria-hidden="true" />
                {i === 0 && <span>Checking for missing sections…</span>}
              </div>
            )}
          </div>
        ))}
      </div>
      <DocumentCheckStatus
        status={status}
        expanded={expanded}
        errorMessage={errorMessage}
        flags={flags}
        acknowledged={acknowledged}
        onAcknowledge={handleAcknowledge}
      />
    </div>
  );
};

// pdfjs-dist is only ever needed for this check, so it's dynamically
// imported to keep it out of the Dashboard's main bundle -- same
// reasoning as W9CompletenessCheck's renderPdfPage. The agreement is
// parsed once and both pages are rendered from that one document (rather
// than re-parsing the file per page) -- this also sidesteps a real
// concurrency issue where two simultaneous dynamic imports of the same
// module can race during tests.
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
  pageNumber: number,
  canvas: HTMLCanvasElement,
) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.5 });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return { width: viewport.width, height: viewport.height };
}

// A checked circle has noticeably more dark ink than an unchecked one
// (which still shows the printed circle outline) -- calibrated during the
// feasibility spike against a fully-filled example (every row's darkness
// landed either ~0.17-0.20 unchecked or ~0.27-0.36 checked, a wide enough
// gap that a fixed threshold is reliable rather than a relative
// comparison between the two circles.
const CIRCLE_DARK_THRESHOLD = 0.24;

function sampleDarkness(
  ctx: CanvasRenderingContext2D,
  box: Box,
  dims: { width: number; height: number },
): number {
  const xs = box.normalizedVertices.map((v) => v.x * dims.width);
  const ys = box.normalizedVertices.map((v) => v.y * dims.height);
  const x = Math.max(0, Math.round(Math.min(...xs)));
  const y = Math.max(0, Math.round(Math.min(...ys)));
  const w = Math.max(1, Math.round(Math.max(...xs) - Math.min(...xs)));
  const h = Math.max(1, Math.round(Math.max(...ys) - Math.min(...ys)));
  const { data } = ctx.getImageData(x, y, w, h);
  let dark = 0;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (luminance < 150) dark++;
  }
  return dark / (data.length / 4);
}

function readRowAnswer(
  ctx: CanvasRenderingContext2D,
  row: Section4Row,
  dims: { width: number; height: number },
): 'yes' | 'no' | 'unanswered' {
  const yesFilled = sampleDarkness(ctx, row.yesBox, dims) > CIRCLE_DARK_THRESHOLD;
  const noFilled = sampleDarkness(ctx, row.noBox, dims) > CIRCLE_DARK_THRESHOLD;
  if (yesFilled && !noFilled) return 'yes';
  if (noFilled && !yesFilled) return 'no';
  return 'unanswered';
}
