/**
 * visionApi.ts
 * Shared fetch/error-handling for Google Cloud Vision API calls, used by
 * parseReceipt.ts and parseBudgetAllocation.ts.
 */

export function getVisionApiKey(): string {
  const apiKey = import.meta.env.VITE_GOOGLE_VISION_API_KEY;
  if (!apiKey) throw new Error('VITE_GOOGLE_VISION_API_KEY is not set in .env');
  return apiKey;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface VisionResponse {
  responses?: Array<{
    fullTextAnnotation?: { text?: string };
    textAnnotations?: Array<{ description?: string }>;
    responses?: Array<{ fullTextAnnotation?: { text?: string } }>;
  }>;
}

// 30s, matching downloadReceiptsZip.ts's fetchBlob -- without this, a
// stalled request (flaky network, a proxy that silently drops the
// connection) left the calling form's "Scanning…" state stuck forever,
// with no way to recover short of refreshing the page.
const VISION_API_TIMEOUT_MS = 30_000;

export async function callVisionApi(
  endpoint: 'images' | 'files',
  requestBody: unknown,
  apiKey: string,
  fallbackErrorMessage: string,
): Promise<VisionResponse> {
  let response: Response;
  try {
    response = await fetch(
      `https://vision.googleapis.com/v1/${endpoint}:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(VISION_API_TIMEOUT_MS),
      },
    );
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'TimeoutError') {
      throw new Error(
        `Vision API request timed out after ${VISION_API_TIMEOUT_MS / 1000} seconds.`,
      );
    }
    throw err;
  }

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message ?? fallbackErrorMessage);
  }

  return response.json();
}

// The single-response text shape shared by images:annotate calls (both
// TEXT_DETECTION and DOCUMENT_TEXT_DETECTION land here). files:annotate's
// multi-page PDF response has its own shape, extracted separately.
export const extractFullText = (data: VisionResponse): string =>
  data.responses?.[0]?.fullTextAnnotation?.text ??
  data.responses?.[0]?.textAnnotations?.[0]?.description ??
  '';
