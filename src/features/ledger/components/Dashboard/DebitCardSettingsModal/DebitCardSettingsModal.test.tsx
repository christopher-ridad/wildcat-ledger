import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { buildMockOrganization, MockLedgerProvider } from '../../../../../test/mocks';
import { LedgerContextValue } from '../../../types';
import { DebitCardSettingsModal } from './DebitCardSettingsModal';

const renderModal = (ledgerOverrides: Partial<LedgerContextValue> = {}, isOpen = true) =>
  render(
    <MockLedgerProvider value={ledgerOverrides}>
      <DebitCardSettingsModal isOpen={isOpen} onClose={vi.fn()} />
    </MockLedgerProvider>,
  );

describe('DebitCardSettingsModal', () => {
  test('renders nothing when closed', () => {
    const { container } = renderModal({}, false);
    expect(container).toBeEmptyDOMElement();
  });

  test('pre-fills fields from the active organization', () => {
    const activeOrganization = buildMockOrganization({
      debitCardSettings: {
        accountNumber: '20 1234-5678-901',
        lastFourDigits: '4321',
        inventoryControlNumber: 'ICN-1',
        loadBalance: 2000,
      },
    });
    renderModal({ activeOrganization });

    expect(screen.getByLabelText('Account Number')).toHaveValue('20 1234-5678-901');
    expect(screen.getByLabelText('Last 4 Digits of Card')).toHaveValue('4321');
    expect(screen.getByLabelText('Inventory Control Number')).toHaveValue('ICN-1');
    expect(screen.getByLabelText('Load Balance')).toHaveValue('2000');
  });

  test('starts blank when the organization has no settings saved yet', () => {
    renderModal({ activeOrganization: buildMockOrganization() });
    expect(screen.getByLabelText('Account Number')).toHaveValue('');
    expect(screen.getByLabelText('Last 4 Digits of Card')).toHaveValue('');
  });

  test('strips non-digit characters from the last-4-digits input', () => {
    renderModal({ activeOrganization: buildMockOrganization() });
    fireEvent.change(screen.getByLabelText('Last 4 Digits of Card'), {
      target: { value: 'ab12cd' },
    });
    expect(screen.getByLabelText('Last 4 Digits of Card')).toHaveValue('12');
  });

  test('rejects a last-4-digits value that is not exactly 4 numbers', async () => {
    const updateDebitCardSettings = vi.fn().mockResolvedValue(undefined);
    renderModal({
      activeOrganization: buildMockOrganization(),
      updateDebitCardSettings,
    });
    fireEvent.change(screen.getByLabelText('Last 4 Digits of Card'), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Last 4 digits must be exactly 4 numbers.'),
    ).toBeInTheDocument();
    expect(updateDebitCardSettings).not.toHaveBeenCalled();
  });

  test('saving calls updateDebitCardSettings with the entered values and closes', async () => {
    const updateDebitCardSettings = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <MockLedgerProvider
        value={{
          activeOrganization: buildMockOrganization(),
          updateDebitCardSettings,
        }}
      >
        <DebitCardSettingsModal isOpen onClose={onClose} />
      </MockLedgerProvider>,
    );

    fireEvent.change(screen.getByLabelText('Account Number'), {
      target: { value: '20 1234-5678-901' },
    });
    fireEvent.change(screen.getByLabelText('Last 4 Digits of Card'), {
      target: { value: '4321' },
    });
    fireEvent.change(screen.getByLabelText('Inventory Control Number'), {
      target: { value: 'ICN-1' },
    });
    fireEvent.change(screen.getByLabelText('Load Balance'), {
      target: { value: '2000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() =>
      expect(updateDebitCardSettings).toHaveBeenCalledWith({
        accountNumber: '20 1234-5678-901',
        lastFourDigits: '4321',
        inventoryControlNumber: 'ICN-1',
        loadBalance: 2000,
      }),
    );
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test('shows an error message when saving fails', async () => {
    const updateDebitCardSettings = vi.fn().mockRejectedValue(new Error('Save failed'));
    renderModal({
      activeOrganization: buildMockOrganization(),
      updateDebitCardSettings,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Save failed')).toBeInTheDocument();
  });

  test('Cancel calls onClose without saving', () => {
    const onClose = vi.fn();
    const updateDebitCardSettings = vi.fn().mockResolvedValue(undefined);
    render(
      <MockLedgerProvider
        value={{
          activeOrganization: buildMockOrganization(),
          updateDebitCardSettings,
        }}
      >
        <DebitCardSettingsModal isOpen onClose={onClose} />
      </MockLedgerProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(updateDebitCardSettings).not.toHaveBeenCalled();
  });

  test('pressing Escape calls onClose', () => {
    const onClose = vi.fn();
    render(
      <MockLedgerProvider value={{ activeOrganization: buildMockOrganization() }}>
        <DebitCardSettingsModal isOpen onClose={onClose} />
      </MockLedgerProvider>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  test('clicking the overlay calls onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <MockLedgerProvider value={{ activeOrganization: buildMockOrganization() }}>
        <DebitCardSettingsModal isOpen onClose={onClose} />
      </MockLedgerProvider>,
    );
    fireEvent.click(container.querySelector('.wl-modal-overlay') as Element);
    expect(onClose).toHaveBeenCalled();
  });
});
