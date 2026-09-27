// Wires checkSpecialPayForm (see check.ts) up to the shared Edge Function
// scaffold. Kept separate from the actual check logic so that logic can be
// unit tested (check.test.ts) without going through a real Document AI
// call.
import {
  centerOf,
  DocumentAiPage,
  extractText,
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

  // TEMP DIAGNOSTIC -- remove once Funding and Employee Certification's
  // false positives on a real upload are root-caused (also Payment
  // Information's box not rendering at all, even though its flag
  // correctly doesn't fire). Kept compact -- a full tokens dump has
  // truncated in the Supabase dashboard's log viewer before.
  console.log(
    'special-pay lines:',
    JSON.stringify(
      lines.map((l) => ({
        text: extractText(text, l.layout?.textAnchor),
        y: centerOf(l.layout?.boundingPoly)?.y,
      })),
    ),
  );
  console.log(
    'special-pay formFields:',
    JSON.stringify(
      formFields.map((f) => ({
        name: extractText(text, f.fieldName?.textAnchor),
        value: extractText(text, f.fieldValue?.textAnchor),
        y: centerOf(f.fieldName?.boundingPoly)?.y,
      })),
    ),
  );
  console.log(
    'special-pay visualElements:',
    JSON.stringify(
      visualElements.map((v) => ({
        type: v.type,
        y: centerOf(v.layout?.boundingPoly)?.y,
      })),
    ),
  );

  return { flags: checkSpecialPayForm(text, formFields, lines, visualElements) };
});
