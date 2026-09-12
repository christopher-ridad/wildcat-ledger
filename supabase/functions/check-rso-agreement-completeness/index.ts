// Wires checkRsoAgreement (see check.ts) up to the shared Edge Function
// scaffold. Kept separate from the actual check logic so that logic can
// be unit tested (check.test.ts) without going through a real Document AI
// call.
import { DocumentAiPage, serveDocumentCheck } from '../_shared/documentAi.ts';
import { checkRsoAgreement } from './check.ts';

serveDocumentCheck((text, pages) => {
  const page1 = (pages[0] ?? {}) as DocumentAiPage;
  const page2 = (pages[1] ?? {}) as DocumentAiPage;

  return checkRsoAgreement(text, page1, page2);
});
