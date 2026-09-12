// Wires checkW9 (see check.ts) up to the shared Edge Function scaffold.
// Kept separate from the actual check logic so that logic can be unit
// tested (check.test.ts) without going through a real Document AI call.
import {
  DocumentAiPage,
  FormField,
  serveDocumentCheck,
  Token,
  VisualElement,
} from '../_shared/documentAi.ts';
import { checkW9 } from './check.ts';

serveDocumentCheck((text, pages) => {
  const page = (pages[0] ?? {}) as DocumentAiPage;
  const formFields: FormField[] = page.formFields ?? [];
  const tokens: Token[] = page.tokens ?? [];
  const visualElements: VisualElement[] = page.visualElements ?? [];

  return { flags: checkW9(text, formFields, tokens, visualElements) };
});
