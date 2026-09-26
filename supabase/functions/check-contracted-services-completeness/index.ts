// Wires checkContractedServices (see check.ts) up to the shared Edge
// Function scaffold. Kept separate from the actual check logic so that
// logic can be unit tested (check.test.ts) without going through a real
// Document AI call.
import {
  DocumentAiPage,
  extractText,
  FormField,
  serveDocumentCheck,
} from '../_shared/documentAi.ts';
import { checkContractedServices } from './check.ts';

serveDocumentCheck((text, pages) => {
  const page = (pages[0] ?? {}) as DocumentAiPage;
  const formFields: FormField[] = page.formFields ?? [];

  // TEMPORARY: this check's field-name matchers were written from the
  // blank template, not a live Document AI response, and a real upload
  // just showed at least two of them (Contractor Name, Address) don't
  // match what Document AI actually returns for this form. Logging every
  // detected field's name/value here (visible in the Supabase dashboard's
  // function logs) so the matchers in check.ts can be corrected against
  // real data instead of guessed again -- remove once that's done.
  console.log(
    'check-contracted-services-completeness formFields:',
    JSON.stringify(
      formFields.map((f) => ({
        name: extractText(text, f.fieldName?.textAnchor),
        value: extractText(text, f.fieldValue?.textAnchor),
      })),
    ),
  );

  return { flags: checkContractedServices(text, formFields) };
});
