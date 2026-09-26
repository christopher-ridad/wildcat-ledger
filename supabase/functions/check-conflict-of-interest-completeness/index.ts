// Wires checkConflictOfInterest (see check.ts) up to the shared Edge
// Function scaffold. Kept separate from the actual check logic so that
// logic can be unit tested (check.test.ts) without going through a real
// Document AI call.
import {
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

  // TEMPORARY: a live test against a real filled example just flagged
  // Vendor Name and Selected/Directed By as blank (both were filled in),
  // and all three Yes/No questions as "couldn't locate" -- the label/
  // anchor-text matchers here were written from the blank template and a
  // separate real Contracted Services Form response, not a real Document
  // AI response for THIS form. Logging every detected field and line
  // (visible in the Supabase dashboard's function logs) so the matchers
  // in check.ts can be corrected against real data -- remove once that's
  // done.
  console.log(
    'check-conflict-of-interest-completeness formFields:',
    JSON.stringify(
      formFields.map((f) => ({
        name: extractText(text, f.fieldName?.textAnchor),
        value: extractText(text, f.fieldValue?.textAnchor),
      })),
    ),
  );
  console.log(
    'check-conflict-of-interest-completeness lines:',
    JSON.stringify(lines.map((l) => extractText(text, l.layout?.textAnchor))),
  );

  return { flags: checkConflictOfInterest(text, formFields, lines, tokens) };
});
