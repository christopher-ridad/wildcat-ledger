// Shared by every "document completeness check" component (W9CompletenessCheck,
// RSOAgreementCompletenessCheck) -- Document AI's normalized-coordinate box
// shape and the logic to draw one onto whichever canvas rendered that page.
export interface Box {
  normalizedVertices: { x: number; y: number }[];
}

// A real W-9 or RSO Agreement is always 1-2 pages -- this is a generous
// upper bound meant to catch an accidental (or not) oversized upload
// before it burns a Document AI page-priced call on something that was
// never going to be one of these forms.
export const MAX_DOCUMENT_CHECK_FILE_BYTES = 15 * 1024 * 1024;

// A byte cap alone doesn't catch a long-but-small file (a multi-page
// essay is easily under 15MB) -- Document AI bills per page, so page
// count is the more direct guard against sending the wrong kind of
// document entirely. Generous enough for a 1-page W-9 or 2-page RSO
// Agreement plus a stray blank/cover page, not so generous it lets an
// actual multi-page document through.
export const MAX_DOCUMENT_CHECK_PAGES = 4;

// Document AI's coordinates are normalized (0-1) to the page, so they
// scale to whatever size the canvas actually rendered at.
export function drawFlagBoxes(
  canvas: HTMLCanvasElement,
  flags: { box: Box | null }[],
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
