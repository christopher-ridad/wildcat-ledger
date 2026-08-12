import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';

import { supabase } from '../config/supabase';
import { uploadDocument } from '../features/ledger/services/storage';
import { UploadDocumentPage } from './UploadDocumentPage';

vi.mock('../config/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock('../features/ledger/services/storage', () => ({
  documentPath: vi.fn(() => 'clubs/org-1/transactions/txn-1/receipt_file.png'),
  uploadDocument: vi.fn().mockResolvedValue(undefined),
}));

const mockRpc = vi.mocked(supabase.rpc);
const mockUploadDocument = vi.mocked(uploadDocument);

const renderAtUrl = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/upload-document${search}`]}>
      <UploadDocumentPage />
    </MemoryRouter>,
  );

const validSearch = '?transactionId=txn-1&orgId=org-1&token=tok-1&fileType=receipt';

describe('UploadDocumentPage', () => {
  test('shows an error for a link missing required parameters, without calling supabase', () => {
    renderAtUrl('');
    expect(
      screen.getByText('Invalid link — missing transaction, organization, or token.'),
    ).toBeInTheDocument();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('shows a load error when the transaction lookup fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'not found' } } as never);
    renderAtUrl(validSearch);
    expect(await screen.findByText('Transaction not found.')).toBeInTheDocument();
  });

  test('shows the transaction title and upload form once loaded', async () => {
    mockRpc.mockResolvedValue({ data: 'Pizza for meeting', error: null } as never);
    renderAtUrl(validSearch);
    expect(await screen.findByText('Pizza for meeting')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Upload Receipt' })).toBeInTheDocument();
  });

  test('defaults to the receipt file type for an unrecognized fileType param', async () => {
    mockRpc.mockResolvedValue({ data: 'Pizza for meeting', error: null } as never);
    renderAtUrl('?transactionId=txn-1&orgId=org-1&token=tok-1&fileType=bogus');
    expect(
      await screen.findByRole('heading', { name: 'Upload Receipt' }),
    ).toBeInTheDocument();
  });

  test('recognizes the specialPayForm file type', async () => {
    mockRpc.mockResolvedValue({ data: 'Guest speaker honorarium', error: null } as never);
    renderAtUrl('?transactionId=txn-1&orgId=org-1&token=tok-1&fileType=specialPayForm');
    expect(
      await screen.findByRole('heading', { name: 'Upload Special Pay Form' }),
    ).toBeInTheDocument();
  });

  test('the upload button stays disabled until a file is selected', async () => {
    mockRpc.mockResolvedValue({ data: 'Pizza for meeting', error: null } as never);
    renderAtUrl(validSearch);
    await screen.findByText('Pizza for meeting');
    expect(screen.getByRole('button', { name: /Upload Receipt/ })).toBeDisabled();
  });

  test('uploading a file succeeds and shows the success screen', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'Pizza for meeting', error: null } as never);
    mockRpc.mockResolvedValueOnce({ data: null, error: null } as never);
    renderAtUrl(validSearch);
    await screen.findByText('Pizza for meeting');

    const input = document.getElementById('upload-doc-file') as HTMLInputElement;
    const file = new File(['x'], 'receipt.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /Upload Receipt/ }));

    expect(await screen.findByText('Done!')).toBeInTheDocument();
    expect(mockUploadDocument).toHaveBeenCalled();
  });

  test('shows an upload error when the upload RPC fails', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'Pizza for meeting', error: null } as never);
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'expired' } } as never);
    renderAtUrl(validSearch);
    await screen.findByText('Pizza for meeting');

    const input = document.getElementById('upload-doc-file') as HTMLInputElement;
    const file = new File(['x'], 'receipt.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /Upload Receipt/ }));

    expect(
      await screen.findByText(
        'Upload failed. The link may have expired or already been used.',
      ),
    ).toBeInTheDocument();
  });
});
