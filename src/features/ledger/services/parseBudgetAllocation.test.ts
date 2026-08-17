import { describe, expect, test, vi } from 'vitest';

import { findAmountNear, parseBudgetAllocation } from './parseBudgetAllocation';
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

const ASG = /\basg\b/i;

describe('findAmountNear', () => {
  test('reads a dollar amount directly on the keyword line', () => {
    expect(findAmountNear(['ASG: $500.00'], ASG)).toBe(500);
  });

  test('ignores a plain integer with no $, comma, or decimal places (e.g. a year)', () => {
    expect(findAmountNear(['ASG 2024'], ASG)).toBe(0);
  });

  test('checks the next line when the keyword line itself has no amount', () => {
    expect(findAmountNear(['ASG', '$500.00'], ASG)).toBe(500);
  });

  test('checks up to two lines below the keyword line (tabular layouts)', () => {
    expect(findAmountNear(['ASG', 'label', '$500.00'], ASG)).toBe(500);
  });

  test('gives up after two lines below the keyword', () => {
    expect(findAmountNear(['ASG', 'a', 'b', '$500.00'], ASG)).toBe(0);
  });

  test('returns 0 when the keyword never appears', () => {
    expect(findAmountNear(['Operating $500.00'], ASG)).toBe(0);
  });

  test('picks the largest amount when multiple appear on the matched line', () => {
    expect(findAmountNear(['ASG: was $200.00, now $500.00'], ASG)).toBe(500);
  });

  test('matches a comma-thousands amount with no $ prefix', () => {
    expect(findAmountNear(['ASG 1,234.56'], ASG)).toBe(1234.56);
  });

  test('matches a plain two-decimal amount with no $ or comma', () => {
    expect(findAmountNear(['ASG 706.74'], ASG)).toBe(706.74);
  });
});

describe('parseBudgetAllocation', () => {
  test('extracts ASG/Operating/Gifts from an image document', async () => {
    mockGetVisionApiKey.mockReturnValue('test-key');
    mockFileToBase64.mockResolvedValue('base64content');
    mockCallVisionApi.mockResolvedValue({
      responses: [
        {
          fullTextAnnotation: {
            text: 'ASG $500.00\nOperating $1,200.00\nGifts $300.00',
          },
        },
      ],
    });

    const file = new File(['x'], 'budget.png', { type: 'image/png' });
    const result = await parseBudgetAllocation(file);

    expect(result).toEqual({ ASG: 500, Operating: 1200, Gifts: 300 });
    expect(mockCallVisionApi).toHaveBeenCalledWith(
      'images',
      expect.anything(),
      'test-key',
      expect.any(String),
    );
  });

  test('extracts ASG/Operating/Gifts from a multi-page PDF', async () => {
    mockGetVisionApiKey.mockReturnValue('test-key');
    mockFileToBase64.mockResolvedValue('base64content');
    mockCallVisionApi.mockResolvedValue({
      responses: [
        {
          responses: [
            { fullTextAnnotation: { text: 'ASG $500.00' } },
            { fullTextAnnotation: { text: 'Operating $1,200.00\nGifts $300.00' } },
          ],
        },
      ],
    });

    const file = new File(['x'], 'budget.pdf', { type: 'application/pdf' });
    const result = await parseBudgetAllocation(file);

    expect(result).toEqual({ ASG: 500, Operating: 1200, Gifts: 300 });
    expect(mockCallVisionApi).toHaveBeenCalledWith(
      'files',
      expect.anything(),
      'test-key',
      expect.any(String),
    );
  });

  test('detects a PDF by filename extension when the mime type is missing', async () => {
    mockGetVisionApiKey.mockReturnValue('test-key');
    mockFileToBase64.mockResolvedValue('base64content');
    mockCallVisionApi.mockResolvedValue({
      responses: [{ responses: [{ fullTextAnnotation: { text: 'ASG $500.00' } }] }],
    });

    const file = new File(['x'], 'budget.pdf', { type: '' });
    await parseBudgetAllocation(file);

    expect(mockCallVisionApi).toHaveBeenCalledWith(
      'files',
      expect.anything(),
      'test-key',
      expect.any(String),
    );
  });

  test('throws when no text could be extracted from the document', async () => {
    mockGetVisionApiKey.mockReturnValue('test-key');
    mockFileToBase64.mockResolvedValue('base64content');
    mockCallVisionApi.mockResolvedValue({
      responses: [{ fullTextAnnotation: { text: '' } }],
    });

    const file = new File(['x'], 'budget.png', { type: 'image/png' });
    await expect(parseBudgetAllocation(file)).rejects.toThrow(
      'No text could be extracted',
    );
  });
});
