import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { BudgetUploadArea, ScanState } from './BudgetUploadArea';

const Harness = ({
  scanState = 'idle' as ScanState,
  scanError = null as string | null,
  isPdf = false,
  previewUrl = null as string | null,
  uploadedFileName = null as string | null,
  onFileChange = vi.fn(),
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  return (
    <BudgetUploadArea
      scanState={scanState}
      scanError={scanError}
      isPdf={isPdf}
      previewUrl={previewUrl}
      uploadedFileName={uploadedFileName}
      fileInputRef={fileInputRef}
      onFileChange={onFileChange}
    />
  );
};

describe('BudgetUploadArea', () => {
  test('shows the default upload placeholder when idle', () => {
    render(<Harness />);
    expect(screen.getByText('Click to upload budget document')).toBeInTheDocument();
  });

  test('shows a scanning indicator while scanning', () => {
    render(<Harness scanState="scanning" />);
    expect(screen.getByText('Scanning document…')).toBeInTheDocument();
  });

  test('shows an image preview when a non-PDF file has a preview URL', () => {
    render(<Harness scanState="done" previewUrl="blob:preview" isPdf={false} />);
    expect(screen.getByAltText('Budget document')).toHaveAttribute('src', 'blob:preview');
  });

  test('shows a filename placeholder for PDFs once scanning has started', () => {
    render(<Harness scanState="done" isPdf uploadedFileName="budget.pdf" />);
    expect(screen.getByText('budget.pdf')).toBeInTheDocument();
  });

  test('does not show the PDF filename placeholder while idle', () => {
    render(<Harness scanState="idle" isPdf uploadedFileName="budget.pdf" />);
    expect(screen.queryByText('budget.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('Click to upload budget document')).toBeInTheDocument();
  });

  test('shows the scan error message and a manual-entry hint', () => {
    render(<Harness scanState="error" scanError="Could not read the document" />);
    expect(
      screen.getByText(
        /Could not read the document.*you can enter amounts manually below/,
      ),
    ).toBeInTheDocument();
  });

  test('does not show an error message outside of the error state', () => {
    render(<Harness scanState="done" />);
    expect(
      screen.queryByText(/you can enter amounts manually below/),
    ).not.toBeInTheDocument();
  });

  test('clicking the upload area triggers the hidden file input', () => {
    render(<Harness />);
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
    fireEvent.click(screen.getByRole('button'));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  test('pressing Enter on the upload area triggers the hidden file input', () => {
    render(<Harness />);
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  test('selecting a file calls onFileChange', () => {
    const onFileChange = vi.fn();
    const { container } = render(<Harness onFileChange={onFileChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'budget.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileChange).toHaveBeenCalled();
  });
});
