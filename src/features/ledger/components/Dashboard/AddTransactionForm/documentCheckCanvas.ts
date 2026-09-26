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
// document entirely. The two document types need different thresholds:
// an RSO Agreement really is always exactly 2 pages, so its cap stays
// tight, but an official W-9 downloaded straight from irs.gov commonly
// bundles 4-6 pages of IRS instructions after the 1-page form itself --
// a real, common, legitimate upload that the check only ever reads page
// 1 of. A shared low threshold rejected those outright; MAX_W9_PAGES is
// deliberately generous so that doesn't happen, while MAX_RSO_PAGES
// stays tight since there's no equivalent legitimate reason for extra
// pages there.
export const MAX_W9_PAGES = 10;
export const MAX_RSO_PAGES = 4;
// Contracted Services and Conflict of Interest are both official 1-page
// forms -- a small allowance for a scanned cover page, nothing more.
export const MAX_CONTRACTED_SERVICES_PAGES = 3;
export const MAX_CONFLICT_OF_INTEREST_PAGES = 3;
// The Special Pay Request Form template itself is 1 page, but what
// actually gets uploaded here commonly also includes the signed DCFS
// Mandated Reporter Acknowledgement it references -- a separate multi-page
// state form -- so this stays more generous than the two above, similar to
// why MAX_W9_PAGES is generous for the IRS's own bundled instructions.
export const MAX_SPECIAL_PAY_PAGES = 6;

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
