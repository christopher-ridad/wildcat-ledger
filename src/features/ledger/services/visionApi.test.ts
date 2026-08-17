import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  callVisionApi,
  extractFullText,
  fileToBase64,
  getVisionApiKey,
} from './visionApi';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('getVisionApiKey', () => {
  test('returns the configured key', () => {
    vi.stubEnv('VITE_GOOGLE_VISION_API_KEY', 'my-test-key');
    expect(getVisionApiKey()).toBe('my-test-key');
  });

  test('throws when the key is not set', () => {
    vi.stubEnv('VITE_GOOGLE_VISION_API_KEY', '');
    expect(() => getVisionApiKey()).toThrow('VITE_GOOGLE_VISION_API_KEY is not set');
  });
});

describe('fileToBase64', () => {
  test('resolves to the base64 payload, stripped of the data URL prefix', async () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    const result = await fileToBase64(file);
    // "hello" base64-encoded, with no "data:...;base64," prefix left in.
    expect(result).toBe('aGVsbG8=');
  });
});

describe('extractFullText', () => {
  test('prefers fullTextAnnotation.text when present', () => {
    const data = {
      responses: [
        {
          fullTextAnnotation: { text: 'full text' },
          textAnnotations: [{ description: 'annotation text' }],
        },
      ],
    };
    expect(extractFullText(data)).toBe('full text');
  });

  test('falls back to the first textAnnotations description', () => {
    const data = {
      responses: [{ textAnnotations: [{ description: 'annotation text' }] }],
    };
    expect(extractFullText(data)).toBe('annotation text');
  });

  test('returns an empty string when neither shape is present', () => {
    expect(extractFullText({ responses: [{}] })).toBe('');
    expect(extractFullText({})).toBe('');
  });
});

describe('callVisionApi', () => {
  test('POSTs to the annotate endpoint with the key as a query param and returns the parsed JSON', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ responses: [{ fullTextAnnotation: { text: 'ok' } }] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await callVisionApi('images', { requests: [] }, 'my-key', 'fallback');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://vision.googleapis.com/v1/images:annotate?key=my-key',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [] }),
      }),
    );
    expect(result).toEqual({ responses: [{ fullTextAnnotation: { text: 'ok' } }] });
  });

  test('throws the API-provided error message on a failed response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: 'referrer blocked' } }),
      }),
    );

    await expect(
      callVisionApi('images', { requests: [] }, 'my-key', 'fallback message'),
    ).rejects.toThrow('referrer blocked');
  });

  test('falls back to the given error message when the response has no error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );

    await expect(
      callVisionApi('images', { requests: [] }, 'my-key', 'fallback message'),
    ).rejects.toThrow('fallback message');
  });
});
