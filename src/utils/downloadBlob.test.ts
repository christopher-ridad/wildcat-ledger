import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { downloadBlob } from './downloadBlob';

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('clicks a named download link that is attached to the page', () => {
    let attachedWhenClicked = false;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        attachedWhenClicked = document.body.contains(this);
      });

    downloadBlob(new Blob(['x']), 'report.pdf');

    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(attachedWhenClicked).toBe(true);
    expect(link.download).toBe('report.pdf');
    expect(link.href).toBe('blob:mock-url');
    expect(document.body.contains(link)).toBe(false);
  });

  test('releases the file only after the download has had time to start', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlob(new Blob(['x']), 'report.pdf');

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
