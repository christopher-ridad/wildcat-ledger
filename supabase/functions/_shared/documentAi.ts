// Shared Google Document AI client for every "check this document for
// likely-missing fields" Edge Function (see GitHub issue #29). Auth is a
// service-account JWT-bearer exchange, since Document AI needs that --
// unlike Vision API's plain browser-safe key (see visionApi.ts) -- which
// is why these checks run server-side at all.
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

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
