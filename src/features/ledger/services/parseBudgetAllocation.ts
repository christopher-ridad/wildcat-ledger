/**
 * parseBudgetAllocation.ts
 * Sends a budget allocation document (image or PDF) to Google Cloud Vision API
 * and extracts Operating, ASG, and Gifts amounts.
 */

export interface BudgetScanResult {
  ASG: number;
  Operating: number;
  Gifts: number;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Find ALL dollar amounts on lines matching a keyword, return the largest one.
 * Also checks the next 2 lines after a keyword match (for table formats where
 * the label and value are on separate lines).
 */
function findAmountNear(lines: string[], keyword: RegExp): number {
  // Only match values that look like actual dollar amounts — must have one of:
  //   - a $ prefix                     → $1234  $1,234.56
  //   - comma thousands separator      → 1,234  1,234.56
  //   - exactly two decimal places     → 706.74
  // Plain integers like "2024" (years) are intentionally excluded.
  const dollarPattern =
    /\$\s*([\d,]+(?:\.\d{1,2})?)|\b(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{2})\b/g;

  const parseMatch = (str: string): number => {
    const matches = [...str.matchAll(dollarPattern)];
    if (!matches.length) return 0;
    const values = matches
      .map((m) => parseFloat((m[1] ?? m[2]).replace(/,/g, '')))
      .filter((n) => !isNaN(n) && n > 0);
    return values.length ? Math.max(...values) : 0;
  };

  for (let i = 0; i < lines.length; i++) {
    if (keyword.test(lines[i])) {
      // Try current line first
      const onLine = parseMatch(lines[i]);
      if (onLine > 0) return onLine;
      // Try next 2 lines (common in tabular/PDF layouts)
      for (let j = i + 1; j <= i + 2 && j < lines.length; j++) {
        const nearby = parseMatch(lines[j]);
        if (nearby > 0) return nearby;
      }
    }
  }
  return 0;
}

/** Extract full text from all pages of a PDF via Vision files:annotate */
async function extractTextFromPdf(base64: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://vision.googleapis.com/v1/files:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            inputConfig: {
              content: base64,
              mimeType: 'application/pdf',
            },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            // Read up to 5 pages
            pages: [1, 2, 3, 4, 5],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message ?? 'Vision API PDF request failed');
  }

  const data = await response.json();
  // files:annotate response: data.responses[0].responses[page].fullTextAnnotation.text
  const pageResponses: unknown[] = data.responses?.[0]?.responses ?? [];
  return pageResponses
    .map(
      (p) =>
        (p as { fullTextAnnotation?: { text?: string } }).fullTextAnnotation?.text ?? '',
    )
    .join('\n');
}

/** Extract full text from an image via Vision images:annotate */
async function extractTextFromImage(base64: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message ?? 'Vision API image request failed');
  }

  const data = await response.json();
  return (
    data.responses?.[0]?.fullTextAnnotation?.text ??
    data.responses?.[0]?.textAnnotations?.[0]?.description ??
    ''
  );
}

export async function parseBudgetAllocation(file: File): Promise<BudgetScanResult> {
  const apiKey = import.meta.env.VITE_GOOGLE_VISION_API_KEY;
  if (!apiKey) throw new Error('VITE_GOOGLE_VISION_API_KEY is not set in .env');

  const base64 = await fileToBase64(file);
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  const fullText = isPdf
    ? await extractTextFromPdf(base64, apiKey)
    : await extractTextFromImage(base64, apiKey);

  if (!fullText.trim()) {
    throw new Error('No text could be extracted from this document');
  }

  const lines = fullText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return {
    ASG: findAmountNear(lines, /\basg\b/i),
    Operating: findAmountNear(lines, /\boperat/i),
    Gifts: findAmountNear(lines, /\bgift/i),
  };
}
