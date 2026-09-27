// Wires checkSpecialPayForm (see check.ts) up to the shared Edge Function
// scaffold. Kept separate from the actual check logic so that logic can be
// unit tested (check.test.ts) without going through a real Document AI
// call.
import {
  DocumentAiPage,
  FormField,
  Line,
  serveDocumentCheck,
  VisualElement,
} from '../_shared/documentAi.ts';
import { checkSpecialPayForm } from './check.ts';

serveDocumentCheck((text, pages) => {
  const page = (pages[0] ?? {}) as DocumentAiPage;
  const formFields: FormField[] = page.formFields ?? [];
  const lines: Line[] = page.lines ?? [];
  const visualElements: VisualElement[] = page.visualElements ?? [];

  return { flags: checkSpecialPayForm(text, formFields, lines, visualElements) };
});
