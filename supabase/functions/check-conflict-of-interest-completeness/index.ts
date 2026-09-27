// Wires checkConflictOfInterest (see check.ts) up to the shared Edge
// Function scaffold. Kept separate from the actual check logic so that
// logic can be unit tested (check.test.ts) without going through a real
// Document AI call.
import {
  centerOf,
  DocumentAiPage,
  extractText,
  FormField,
  Line,
  serveDocumentCheck,
  Token,
  VisualElement,
} from '../_shared/documentAi.ts';
import { checkConflictOfInterest } from './check.ts';

// A real logged response confirmed Vendor Name and two of three Yes/No
// rows' checkmarks are already detected correctly -- the one open
// question is whether row 1's checkmark (the "employed by" row) shows up
// *anywhere* in Document AI's output at all. Scoped tight to that row's
// own vertical band (with a little padding) rather than the whole page,
// so the logged output stays small enough not to get truncated in the
// Supabase dashboard.
const ROW_1_Y_BAND = { yMin: 0.35, yMax: 0.42 };
const inBand = (y: number | undefined) =>
  y !== undefined && y >= ROW_1_Y_BAND.yMin && y <= ROW_1_Y_BAND.yMax;

serveDocumentCheck((text, pages) => {
  const page = (pages[0] ?? {}) as DocumentAiPage;
  const formFields: FormField[] = page.formFields ?? [];
  const lines: Line[] = page.lines ?? [];
  const tokens: Token[] = page.tokens ?? [];
  const visualElements: VisualElement[] = page.visualElements ?? [];

  // TEMPORARY: remove once row 1's gap is resolved or accepted.
  console.log(
    'check-conflict-of-interest-completeness row1-lines:',
    JSON.stringify(
      lines
        .filter((l) => inBand(centerOf(l.layout?.boundingPoly)?.y))
        .map((l) => ({
          text: extractText(text, l.layout?.textAnchor),
          y: centerOf(l.layout?.boundingPoly)?.y,
        })),
    ),
  );
  console.log(
    'check-conflict-of-interest-completeness row1-tokens:',
    JSON.stringify(
      tokens
        .filter((t) => inBand(centerOf(t.layout?.boundingPoly)?.y))
        .map((t) => ({
          text: extractText(text, t.layout?.textAnchor),
          center: centerOf(t.layout?.boundingPoly),
        })),
    ),
  );
  console.log(
    'check-conflict-of-interest-completeness row1-visualElements:',
    JSON.stringify(
      visualElements
        .filter((v) => inBand(centerOf(v.layout?.boundingPoly)?.y))
        .map((v) => ({ type: v.type, center: centerOf(v.layout?.boundingPoly) })),
    ),
  );
  console.log(
    'check-conflict-of-interest-completeness visualElements count (whole page):',
    visualElements.length,
  );

  return { flags: checkConflictOfInterest(text, formFields, lines) };
});
