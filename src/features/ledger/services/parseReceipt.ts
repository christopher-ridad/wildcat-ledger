/**
 * parseReceipt.ts
 * Sends a receipt image to Google Cloud Vision API (TEXT_DETECTION)
 * and extracts the most likely total amount and vendor/title.
 */

import {
  callVisionApi,
  extractFullText,
  fileToBase64,
  getVisionApiKey,
} from './visionApi';

export interface ReceiptData {
  title: string;
  amount: string;
}

// Extract the best total dollar amount from OCR text.
// Prioritises lines containing "total", "amount due", "balance due", "grand total".
export function extractAmount(text: string): string {
  const lines = text.split('\n').map((l) => l.trim());

  const totalKeywords = /total|amount due|balance due|grand total|subtotal/i;
  const dollarPattern = /\$?\s*(\d{1,4}[.,]\d{2})\b/;

  for (const line of lines) {
    if (totalKeywords.test(line)) {
      const m = line.match(dollarPattern);
      if (m) return m[1].replace(',', '.');
    }
  }

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
export function extractTitle(text: string): string {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  const skipPatterns =
    /^\d|receipt|invoice|www\.|\.com|tel:|phone|fax|tax|subtotal|total|thank you|date|time|order|#|@/i;

  for (const line of lines) {
    if (!skipPatterns.test(line) && /[a-zA-Z]/.test(line)) {
      return line.slice(0, 60);
    }
  }
  return '';
}

export async function parseReceipt(file: File): Promise<ReceiptData> {
  const apiKey = getVisionApiKey();
  const base64 = await fileToBase64(file);

  const data = await callVisionApi(
    'images',
    {
      requests: [
        {
          image: { content: base64 },
          features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
        },
      ],
    },
    apiKey,
    'Vision API request failed',
  );
  const fullText = extractFullText(data);

  return {
    title: extractTitle(fullText),
    amount: extractAmount(fullText),
  };
}
