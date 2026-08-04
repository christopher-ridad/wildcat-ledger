/**
 * parseReceipt.ts
 * Sends a receipt image to Google Cloud Vision API (TEXT_DETECTION)
 * and extracts the most likely total amount and vendor/title.
 */

export interface ReceiptData {
  title: string;
  amount: string;
}

// Convert a File to a base64 string (without the data: prefix)
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:image/...;base64," prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Extract the best total dollar amount from OCR text.
// Prioritises lines containing "total", "amount due", "balance due", "grand total".
function extractAmount(text: string): string {
  const lines = text.split('\n').map((l) => l.trim());

  // Priority 1: lines that contain total-like keywords + a dollar amount
  const totalKeywords = /total|amount due|balance due|grand total|subtotal/i;
  const dollarPattern = /\$?\s*(\d{1,4}[.,]\d{2})\b/;

  for (const line of lines) {
    if (totalKeywords.test(line)) {
      const m = line.match(dollarPattern);
      if (m) return m[1].replace(',', '.');
    }
  }

  // Priority 2: largest dollar amount on any line
  let largest = 0;
  let largestStr = '';
  for (const line of lines) {
    const matches = [...line.matchAll(/\$?\s*(\d{1,4}[.,]\d{2})\b/g)];
    for (const m of matches) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (val > largest) {
        largest = val;
        largestStr = m[1].replace(',', '.');
      }
    }
  }
  return largestStr;
}

// Extract a vendor / title from OCR text.
// Usually the first non-empty, non-numeric, non-address line.
function extractTitle(text: string): string {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  const skipPatterns =
    /^\d|receipt|invoice|www\.|\.com|tel:|phone|fax|tax|subtotal|total|thank you|date|time|order|#|@/i;

  for (const line of lines) {
    if (!skipPatterns.test(line) && /[a-zA-Z]/.test(line)) {
      // Truncate to reasonable title length
      return line.slice(0, 60);
    }
  }
  return '';
}

export async function parseReceipt(file: File): Promise<ReceiptData> {
  const apiKey = import.meta.env.VITE_GOOGLE_VISION_API_KEY;
  if (!apiKey) throw new Error('VITE_GOOGLE_VISION_API_KEY is not set in .env');

  const base64 = await fileToBase64(file);

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message ?? 'Vision API request failed');
  }

  const data = await response.json();
  const fullText: string =
    data.responses?.[0]?.fullTextAnnotation?.text ??
    data.responses?.[0]?.textAnnotations?.[0]?.description ??
    '';

  return {
    title: extractTitle(fullText),
    amount: extractAmount(fullText),
  };
}
