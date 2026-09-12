// Shared by every "document completeness check" component (W9CompletenessCheck,
// RSOAgreementCompletenessCheck) -- Document AI's normalized-coordinate box
// shape and the logic to draw one onto whichever canvas rendered that page.
export interface Box {
  normalizedVertices: { x: number; y: number }[];
}

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
