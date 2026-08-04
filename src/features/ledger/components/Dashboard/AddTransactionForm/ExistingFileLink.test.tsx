import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { getSignedFileUrl } from '../../../services/storage';
import { ExistingFileLink } from './ExistingFileLink';

vi.mock('../../../services/storage', () => ({
  getSignedFileUrl: vi.fn(),
}));

describe('ExistingFileLink', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('opens a signed URL in a new tab when clicked', async () => {
    vi.mocked(getSignedFileUrl).mockResolvedValue('https://signed.example/receipt.png');
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<ExistingFileLink path="orgs/1/receipt.png" />);
    fireEvent.click(screen.getByText('View file'));

    await vi.waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        'https://signed.example/receipt.png',
        '_blank',
        'noopener,noreferrer',
      );
    });
    expect(getSignedFileUrl).toHaveBeenCalledWith('orgs/1/receipt.png');
  });

  test('silently ignores a failure to fetch the signed URL', async () => {
    vi.mocked(getSignedFileUrl).mockRejectedValue(new Error('network error'));
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<ExistingFileLink path="orgs/1/receipt.png" />);
    fireEvent.click(screen.getByText('View file'));

    await vi.waitFor(() => {
      expect(getSignedFileUrl).toHaveBeenCalled();
    });
    expect(openSpy).not.toHaveBeenCalled();
  });
});
