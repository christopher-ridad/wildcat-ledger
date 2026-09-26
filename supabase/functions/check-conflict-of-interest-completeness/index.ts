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
} from '../_shared/documentAi.ts';
import { checkConflictOfInterest } from './check.ts';

serveDocumentCheck((text, pages) => {
  const page = (pages[0] ?? {}) as DocumentAiPage;
  const formFields: FormField[] = page.formFields ?? [];
  const lines: Line[] = page.lines ?? [];
  const tokens: Token[] = page.tokens ?? [];

  // TEMPORARY: a real logged response already fixed the Vendor Name
  // label/value line split and confirmed checkmarks OCR as a real glyph
  // for two of three Yes/No rows -- the third row's checkmark didn't show
  // up as that glyph on that same response, a possible genuine OCR gap
  // rather than a position bug. Keeping this in place specifically to see
  // whether row 1 still misfires, and if so, whether its mark shows up
  // differently at the token level even though it didn't as its own line.
  // Remove once a live test comes back clean.
  console.log(
    'check-conflict-of-interest-completeness formFields:',
    JSON.stringify(
      formFields.map((f) => ({
        name: extractText(text, f.fieldName?.textAnchor),
        value: extractText(text, f.fieldValue?.textAnchor),
        y: centerOf(f.fieldName?.boundingPoly)?.y,
      })),
    ),
  );
  console.log(
    'check-conflict-of-interest-completeness lines:',
    JSON.stringify(
      lines.map((l) => ({
        text: extractText(text, l.layout?.textAnchor),
        y: centerOf(l.layout?.boundingPoly)?.y,
      })),
    ),
  );
  console.log(
    'check-conflict-of-interest-completeness tokens:',
    JSON.stringify(
      tokens.map((t) => ({
        text: extractText(text, t.layout?.textAnchor),
        center: centerOf(t.layout?.boundingPoly),
      })),
    ),
  );

  return { flags: checkConflictOfInterest(text, formFields, lines) };
});
