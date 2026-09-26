// Wires checkConflictOfInterest (see check.ts) up to the shared Edge
// Function scaffold. Kept separate from the actual check logic so that
// logic can be unit tested (check.test.ts) without going through a real
// Document AI call.
import {
  DocumentAiPage,
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

  return { flags: checkConflictOfInterest(text, formFields, lines, tokens) };
});
