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

  // TEMPORARY: two rounds of live testing against real filled examples
  // have already corrected the name fields and the Yes/No question
  // anchors once each, and this round adds Y-range disambiguation for
  // Signature/Date -- none of which were confirmed against real Document
  // AI position data. Logging every detected field, line, and token
  // position (visible in the Supabase dashboard's function logs) so any
  // remaining mismatch can be fixed against real data instead of guessed
  // again -- remove once a live test comes back clean.
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

  return { flags: checkConflictOfInterest(text, formFields, lines, tokens) };
});
