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
        projectId: 'PRJ-42',
        accountNumber: '2000-000',
        lastFourDigits: '4321',
        inventoryControlNumber: '12345678-1234567',
        loadBalance: 2000,
      },
    });
    renderModal({ activeOrganization });

    expect(screen.getByLabelText('Project ID')).toHaveValue('PRJ-42');
    expect(screen.getByLabelText('Account No.')).toHaveValue('2000-000');
    expect(screen.getByLabelText('Last 4 Digits of Card')).toHaveValue('4321');
    expect(screen.getByLabelText('Inventory Control No.')).toHaveValue(
      '12345678-1234567',
    );
    expect(screen.getByLabelText('Load Balance')).toHaveValue('2000');
  });

  test('starts blank when the organization has no settings saved yet', () => {
    renderModal({ activeOrganization: buildMockOrganization() });
    expect(screen.getByLabelText('Project ID')).toHaveValue('');
    expect(screen.getByLabelText('Account No.')).toHaveValue('');
    expect(screen.getByLabelText('Last 4 Digits of Card')).toHaveValue('');
  });

  test('strips non-digit characters from the last-4-digits input', () => {
    renderModal({ activeOrganization: buildMockOrganization() });
    fireEvent.change(screen.getByLabelText('Last 4 Digits of Card'), {
      target: { value: 'ab12cd' },
    });
    expect(screen.getByLabelText('Last 4 Digits of Card')).toHaveValue('12');
  });

  test("auto-inserts a dash into the Account No. as it's typed", () => {
    renderModal({ activeOrganization: buildMockOrganization() });
    fireEvent.change(screen.getByLabelText('Account No.'), {
      target: { value: '20ab00000extra' },
    });
    // Non-digits stripped, capped at 7 digits, dash after the 4th.
    expect(screen.getByLabelText('Account No.')).toHaveValue('2000-000');
  });

  test("auto-inserts a dash into the Inventory Control No. as it's typed", () => {
    renderModal({ activeOrganization: buildMockOrganization() });
    fireEvent.change(screen.getByLabelText('Inventory Control No.'), {
      target: { value: '123456781234567extra' },
    });
    // Non-digits stripped, capped at 15 digits, dash after the 8th.
    expect(screen.getByLabelText('Inventory Control No.')).toHaveValue(
      '12345678-1234567',
    );
  });

  test('rejects an Account No. that is not in the 20XX-XXX format', async () => {
    const updateDebitCardSettings = vi.fn().mockResolvedValue(undefined);
    renderModal({
      activeOrganization: buildMockOrganization(),
      updateDebitCardSettings,
    });
    fireEvent.change(screen.getByLabelText('Account No.'), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText(
        'Account No. must be in the format 20XX-XXX (e.g. 2000-000).',
      ),
    ).toBeInTheDocument();
    expect(updateDebitCardSettings).not.toHaveBeenCalled();
  });

  test('rejects an Inventory Control No. that is not in the 8-digit-dash-7-digit format', async () => {
    const updateDebitCardSettings = vi.fn().mockResolvedValue(undefined);
    renderModal({
      activeOrganization: buildMockOrganization(),
      updateDebitCardSettings,
    });
    fireEvent.change(screen.getByLabelText('Inventory Control No.'), {
      target: { value: '123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText(
        'Inventory Control No. must be in the format XXXXXXXX-XXXXXXX (e.g. 12345678-1234567).',
      ),
    ).toBeInTheDocument();
    expect(updateDebitCardSettings).not.toHaveBeenCalled();
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

  test('rejects a negative load balance', async () => {
    const updateDebitCardSettings = vi.fn().mockResolvedValue(undefined);
    renderModal({
      activeOrganization: buildMockOrganization(),
      updateDebitCardSettings,
    });
    fireEvent.change(screen.getByLabelText('Load Balance'), {
      target: { value: '-5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Enter a valid load balance.')).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText('Project ID'), {
      target: { value: 'PRJ-42' },
    });
    fireEvent.change(screen.getByLabelText('Account No.'), {
      target: { value: '2000000' },
    });
    fireEvent.change(screen.getByLabelText('Last 4 Digits of Card'), {
      target: { value: '4321' },
    });
    fireEvent.change(screen.getByLabelText('Inventory Control No.'), {
      target: { value: '123456781234567' },
    });
    fireEvent.change(screen.getByLabelText('Load Balance'), {
      target: { value: '2000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() =>
      expect(updateDebitCardSettings).toHaveBeenCalledWith({
        projectId: 'PRJ-42',
        accountNumber: '2000-000',
        inventoryControlNumber: '12345678-1234567',
        lastFourDigits: '4321',
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
