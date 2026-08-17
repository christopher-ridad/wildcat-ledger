import { describe, expect, test, vi } from 'vitest';

import { extractAmount, extractTitle, parseReceipt } from './parseReceipt';
import { callVisionApi, fileToBase64, getVisionApiKey } from './visionApi';

vi.mock('./visionApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./visionApi')>()),
  getVisionApiKey: vi.fn(),
  fileToBase64: vi.fn(),
  callVisionApi: vi.fn(),
}));

const mockGetVisionApiKey = vi.mocked(getVisionApiKey);
const mockFileToBase64 = vi.mocked(fileToBase64);
const mockCallVisionApi = vi.mocked(callVisionApi);

describe('extractAmount', () => {
  test('picks the amount on a line with a "total" keyword', () => {
    const text = 'Coffee Shop\nLatte 4.50\nTotal $12.34\nThank you';
    expect(extractAmount(text)).toBe('12.34');
  });

  test('recognizes "amount due", "balance due", and "grand total" as keywords too', () => {
    expect(extractAmount('Balance Due: $8.00')).toBe('8.00');
    expect(extractAmount('Amount Due 9.00')).toBe('9.00');
    expect(extractAmount('Grand Total $10.00')).toBe('10.00');
  });

  test('normalizes a comma decimal separator to a period', () => {
    expect(extractAmount('Total 45,67')).toBe('45.67');
  });

  test('falls back to the largest dollar-like value when no keyword line matches', () => {
    const text = 'Item A 3.00\nItem B 15.00\nItem C 7.50';
    expect(extractAmount(text)).toBe('15.00');
  });

  test('returns an empty string when no dollar amounts are present', () => {
    expect(extractAmount('Just some text\nwith no prices')).toBe('');
  });

  test('uses the first keyword-matching line, even if a later one is larger', () => {
    const text = 'Subtotal 5.00\nTotal 20.00';
    expect(extractAmount(text)).toBe('5.00');
  });
});

describe('extractTitle', () => {
  test('returns the first plain-text line as the vendor name', () => {
    const text = 'Coffee Shop\n123 Main St\nTotal $4.50';
    expect(extractTitle(text)).toBe('Coffee Shop');
  });

  test('skips lines starting with a digit', () => {
    const text = '123 Main St\nCoffee Shop\nTotal $4.50';
    expect(extractTitle(text)).toBe('Coffee Shop');
  });

  test('skips lines matching receipt/invoice/contact/date boilerplate', () => {
    const text = 'RECEIPT\nwww.example.com\nTel: 555-1234\nDate: 01/01/2026\nCoffee Shop';
    expect(extractTitle(text)).toBe('Coffee Shop');
  });

  test('returns an empty string when every line is boilerplate or too short', () => {
    const text = 'RECEIPT\n123\nwww.example.com';
    expect(extractTitle(text)).toBe('');
  });

  test('truncates a very long line to 60 characters', () => {
    const longLine = 'A'.repeat(80);
    expect(extractTitle(longLine)).toHaveLength(60);
  });
});

describe('parseReceipt', () => {
  test('extracts title and amount from the OCR response text', async () => {
    mockGetVisionApiKey.mockReturnValue('test-key');
    mockFileToBase64.mockResolvedValue('base64content');
    mockCallVisionApi.mockResolvedValue({
      responses: [{ fullTextAnnotation: { text: 'Coffee Shop\nTotal $4.50' } }],
    });

    const file = new File(['x'], 'receipt.png', { type: 'image/png' });
    const result = await parseReceipt(file);

    expect(result).toEqual({ title: 'Coffee Shop', amount: '4.50' });
  });

  test('propagates an error when the API key is missing', async () => {
    mockGetVisionApiKey.mockImplementation(() => {
      throw new Error('VITE_GOOGLE_VISION_API_KEY is not set in .env');
    });

    const file = new File(['x'], 'receipt.png', { type: 'image/png' });
    await expect(parseReceipt(file)).rejects.toThrow('VITE_GOOGLE_VISION_API_KEY');
  });
});
