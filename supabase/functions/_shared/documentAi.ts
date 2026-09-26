// Shared Google Document AI client for every "check this document for
// likely-missing fields" Edge Function. Auth is a service-account
// JWT-bearer exchange, since Document AI needs that -- unlike Vision
// API's plain browser-safe key (see visionApi.ts) -- which is why these
// checks run server-side at all.
import { createSign } from 'node:crypto';

export interface Box {
  normalizedVertices: { x: number; y: number }[];
}
export interface FieldSide {
  textAnchor?: { textSegments?: { startIndex?: string; endIndex?: string }[] };
  boundingPoly?: Box;
}
export interface FormField {
  fieldName?: FieldSide;
  fieldValue?: FieldSide;
}
export interface Token {
  layout?: FieldSide;
}
export interface Line {
  layout?: FieldSide;
}
export interface VisualElement {
  type?: string;
  layout?: FieldSide;
}
export interface DocumentAiPage {
  formFields?: FormField[];
  tokens?: Token[];
  lines?: Line[];
  visualElements?: VisualElement[];
}

export function extractText(fullText: string, textAnchor?: FieldSide['textAnchor']) {
  if (!textAnchor?.textSegments?.length || !fullText) return '';
  return textAnchor.textSegments
    .map((seg) => fullText.slice(Number(seg.startIndex ?? 0), Number(seg.endIndex)))
    .join('');
}

// Builds a rectangular Box from its min/max edges, in the same
// clockwise-from-top-left vertex order Document AI itself uses -- every
// hand-captured fallback position (a form's fixed printed layout) is one
// of these rather than a hand-typed 4-vertex literal, which is easy to
// get subtly wrong by eye.
export function boxFrom(xMin: number, xMax: number, yMin: number, yMax: number): Box {
  return {
    normalizedVertices: [
      { x: xMin, y: yMin },
      { x: xMax, y: yMin },
      { x: xMax, y: yMax },
      { x: xMin, y: yMax },
    ],
  };
}

// Every "is this near a known position" or "where on the page is this"
// check ends up averaging a box's normalizedVertices into a single
// center point -- this is that computation, written once.
export function centerOf(box?: Box): { x: number; y: number } | null {
  const vertices = box?.normalizedVertices;
  if (!vertices?.length) return null;
  return {
    x: vertices.reduce((sum, v) => sum + v.x, 0) / vertices.length,
    y: vertices.reduce((sum, v) => sum + v.y, 0) / vertices.length,
  };
}

const base64url = (input: ArrayBuffer | string) => {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function getAccessToken(key: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = createSign('RSA-SHA256')
    .update(signingInput)
    .sign(key.private_key, 'base64url');
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

export interface DocumentAiConfig {
  processorId: string;
  region: string;
  serviceAccountKeyJson: string;
}

export function loadDocumentAiConfig(): DocumentAiConfig {
  const processorId = Deno.env.get('DOCUMENT_AI_PROCESSOR_ID');
  const region = Deno.env.get('DOCUMENT_AI_REGION') ?? 'us';
  const serviceAccountKeyJson = Deno.env.get('DOCUMENT_AI_SERVICE_ACCOUNT_KEY');
  if (!processorId || !serviceAccountKeyJson) {
    throw new Error('Document AI is not configured for this environment.');
  }
  return { processorId, region, serviceAccountKeyJson };
}

// Processes a document's content (base64 file bytes plus its mime type)
// and returns Document AI's page-level analysis for every page -- the W-9
// is one page so it only ever reads pages[0], but the RSO agreement is two
// and needs both.
export async function processDocument(
  config: DocumentAiConfig,
  contentBase64: string,
  mimeType: string,
): Promise<{ text: string; pages: DocumentAiPage[] }> {
  const key = JSON.parse(config.serviceAccountKeyJson);
  const accessToken = await getAccessToken(key);

  const url = `https://${config.region}-documentai.googleapis.com/v1/projects/${key.project_id}/locations/${config.region}/processors/${config.processorId}:process`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rawDocument: { content: contentBase64, mimeType } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Document AI call failed: ${JSON.stringify(data)}`);

  return {
    text: data.document?.text ?? '',
    pages: data.document?.pages ?? [],
  };
}

export interface PresenceFlag {
  label: string;
  message: string;
  box: Box | null;
}

// Document AI's OCR occasionally reads a Latin letter as its Greek
// lookalike in certain fonts/sizes -- confirmed on a real Contracted
// Services Form upload, where "To:" was read back as "Το:" (Greek
// capital Tau + lowercase omicron, not Latin T + o). Applied to
// already-lowercased text before any label comparison, in every check
// that uses checkLabeledFieldsRobust below, so a match isn't thrown off
// by this. Greek letters lowercase predictably via .toLowerCase() the
// same way Latin ones do, so this only needs to handle the lowercase
// forms.
export function normalizeHomoglyphs(lowercased: string): string {
  return lowercased.replace(/τ/g, 't').replace(/ο/g, 'o');
}

export interface RobustFieldSpec {
  // Try Document AI's own formFields pairing first, when given -- a more
  // precise box than the line fallback below gets, and correct more often
  // than not. Matched against the field name after normalizeHomoglyphs,
  // trim, and lowercase. Omit for a field Document AI has never been seen
  // to pair as a formField at all (skips straight to the line fallback).
  matchFieldName?: (name: string) => boolean;
  // Fallback for when formFields didn't pair this field at all, or paired
  // it with an empty value -- confirmed happening on real uploads (see
  // each check's own header comment for which fields and why). A literal,
  // lowercase substring searched for among the page's raw OCR'd lines.
  lineLabel: string;
  // Where the actual value prints relative to the matched line:
  //  - 'sameLine': immediately after the label on the same OCR'd line
  //    ("Name: John Doe"). Only the text after the label on that line
  //    counts.
  //  - 'nextLine': on the line below the label's own line -- for a label
  //    that has its own trailing static/instructional text (which would
  //    otherwise look like a filled-in value if the same line were
  //    checked), or a value that only ever prints on its own line, such
  //    as a multi-line text box.
  // Deliberately no "try both" option: a blank sameLine field would
  // almost always find *some* content on the next OCR'd line anyway --
  // typically the start of the next field entirely -- which would read as
  // a false "filled." Each spec has to commit to the one that's actually
  // true for that field.
  valueLocation: 'sameLine' | 'nextLine';
  // 'nextLine' only: literal, lowercase prefixes that, if the next line
  // starts with one, mean that line is actually the form's own static
  // text -- a following section's heading, say -- not a real value. A
  // blank multi-line text box usually produces no OCR'd line of its own
  // at all, so the "next line" found is really whatever prints after the
  // box, not inside it; without this, a genuinely blank field would read
  // as filled every time (confirmed while testing Contracted Services'
  // Additional Description of Services, immediately followed on the real
  // form by the "Contractor's Acknowledgement" section heading whether
  // the description itself was filled in or not).
  nextLineBoilerplate?: string[];
  label: string;
  message: string;
}

export interface LabeledFieldStatus {
  spec: RobustFieldSpec;
  filled: boolean;
  box: Box | null;
}

// The actual per-field lookup checkLabeledFieldsRobust and section-grouped
// checks both build on: tries Document AI's formFields pairing first, and
// falls back to scanning the page's raw OCR'd lines directly when
// formFields doesn't pair the field at all -- these forms' fields aren't
// reliably paired into formFields the way the W-9's are (confirmed on a
// real Contracted Services Form upload, where Name and Address Line 1
// never appeared in formFields at all despite being filled in). Returns a
// status for every spec, not just the unfilled ones, so a caller that
// wants to group several fields under one section-level flag (see
// unionBoxes below) has each member's own box to work with even when it
// turned out to be filled.
export function findLabeledFieldStatuses(
  documentText: string,
  formFields: FormField[],
  lines: Line[],
  specs: RobustFieldSpec[],
): LabeledFieldStatus[] {
  return specs.map((spec) => {
    const field = spec.matchFieldName
      ? formFields.find((f) =>
          spec.matchFieldName!(
            normalizeHomoglyphs(
              extractText(documentText, f.fieldName?.textAnchor).trim().toLowerCase(),
            ),
          ),
        )
      : undefined;
    if (field && extractText(documentText, field.fieldValue?.textAnchor).trim()) {
      // Document AI paired this field with a non-empty value.
      return { spec, filled: true, box: field.fieldName?.boundingPoly ?? null };
    }

    let filled = false;
    let box: Box | null = field?.fieldName?.boundingPoly ?? null;
    for (let i = 0; i < lines.length; i++) {
      const lineText = extractText(documentText, lines[i].layout?.textAnchor);
      const idx = normalizeHomoglyphs(lineText.toLowerCase()).indexOf(spec.lineLabel);
      if (idx === -1) continue;

      box = box ?? lines[i].layout?.boundingPoly ?? null;
      const sameLineAfter = lineText.slice(idx + spec.lineLabel.length).trim();
      const nextLineTextRaw = lines[i + 1]
        ? extractText(documentText, lines[i + 1].layout?.textAnchor).trim()
        : '';
      const nextLineNormalized = normalizeHomoglyphs(nextLineTextRaw.toLowerCase());
      const nextLineIsBoilerplate = (spec.nextLineBoilerplate ?? []).some((p) =>
        nextLineNormalized.startsWith(p),
      );
      const nextLineText = nextLineIsBoilerplate ? '' : nextLineTextRaw;
      filled =
        spec.valueLocation === 'sameLine'
          ? sameLineAfter.length > 0
          : nextLineText.length > 0;
      break; // use the first matching line
    }

    return { spec, filled, box };
  });
}

// A "does this labeled field have any text in it" check for the simpler
// completeness checks (Contracted Services, Conflict of Interest, Special
// Pay Form) -- one flag per unfilled field. See findLabeledFieldStatuses
// above for what this builds on; use that directly instead when several
// fields need grouping under one section-level flag.
export function checkLabeledFieldsRobust(
  documentText: string,
  formFields: FormField[],
  lines: Line[],
  specs: RobustFieldSpec[],
): PresenceFlag[] {
  return findLabeledFieldStatuses(documentText, formFields, lines, specs)
    .filter((status) => !status.filled)
    .map((status) => ({
      label: status.spec.label,
      message: status.spec.message,
      box: status.box,
    }));
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Every "check this document" Edge Function shares the same scaffold --
// OPTIONS handling, loading config, pulling the uploaded file out of the
// request body, and the success/error JSON response shape -- so each one
// only needs to supply the part that's actually specific to it: turning
// Document AI's parsed pages into that check's own result shape.
export function serveDocumentCheck(
  buildResult: (text: string, pages: DocumentAiPage[]) => unknown,
) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
      const config = loadDocumentAiConfig();
      const { fileBase64 } = await req.json();
      if (!fileBase64) throw new Error('No file provided.');

      const { text, pages } = await processDocument(
        config,
        fileBase64,
        'application/pdf',
      );
      const result = buildResult(text, pages);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  });
}
