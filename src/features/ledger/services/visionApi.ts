/**
 * visionApi.ts
 * Shared fetch/error-handling for Google Cloud Vision API calls, used by
 * parseReceipt.ts and parseBudgetAllocation.ts.
 */

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

export async function callVisionApi(
  endpoint: 'images' | 'files',
  requestBody: unknown,
  apiKey: string,
  fallbackErrorMessage: string,
): Promise<VisionResponse> {
  const response = await fetch(
    `https://vision.googleapis.com/v1/${endpoint}:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    },
  );

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
