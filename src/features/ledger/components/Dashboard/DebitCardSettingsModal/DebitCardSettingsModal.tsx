import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { useLedger } from '../../../hooks/useLedger';
import { Modal } from '../Modal';
import styles from './DebitCardSettingsModal.module.css';

interface DebitCardSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Formats sourced from the official SOFO form's own validation -- see
// docs/BUSINESS_RULES.md#sofo--cashiers-office-settings.
const PROJECT_ID_PATTERN = /^7\d{7}$/; // 70000000-79999999
const ACCOUNT_NUMBER_PATTERN = /^20\d{2}-\d{3}$/; // e.g. 2000-000
const ICN_PATTERN = /^\d{8}-\d{7}$/; // e.g. 12345678-1234567

const formatWithDash = (raw: string, digitsBeforeDash: number, maxDigits: number) => {
  const digits = raw.replace(/\D/g, '').slice(0, maxDigits);
  return digits.length > digitsBeforeDash
    ? `${digits.slice(0, digitsBeforeDash)}-${digits.slice(digitsBeforeDash)}`
    : digits;
};

export const DebitCardSettingsModal = ({
  isOpen,
  onClose,
}: DebitCardSettingsModalProps) => {
  const { activeOrganization, updateDebitCardSettings } = useLedger();
  const settings = activeOrganization?.debitCardSettings;

  const [projectId, setProjectId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [inventoryControlNumber, setInventoryControlNumber] = useState('');
  const [lastFourDigits, setLastFourDigits] = useState('');
  const [loadBalance, setLoadBalance] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset fields on the actual open transition only, not on every
  // subsequent re-render while the modal stays open (settings is a new
  // object reference each time activeOrganization refreshes via Realtime,
  // which shouldn't clobber whatever the user is mid-typing).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setProjectId(settings?.projectId ?? '');
      setAccountNumber(settings?.accountNumber ?? '');
      setInventoryControlNumber(settings?.inventoryControlNumber ?? '');
      setLastFourDigits(settings?.lastFourDigits ?? '');
      setLoadBalance(settings?.loadBalance != null ? String(settings.loadBalance) : '');
      setError(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, settings]);

  const handleProjectIdChange = (e: ChangeEvent<HTMLInputElement>) => {
    setProjectId(e.target.value.replace(/\D/g, '').slice(0, 8));
  };

  const handleAccountNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAccountNumber(formatWithDash(e.target.value, 4, 7));
  };

  const handleInventoryControlNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInventoryControlNumber(formatWithDash(e.target.value, 8, 15));
  };

  const handleSave = async () => {
    if (projectId && !PROJECT_ID_PATTERN.test(projectId)) {
      setError('Project ID must be an 8-digit number between 70000000 and 79999999.');
      return;
    }
    if (accountNumber && !ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
      setError('Account No. must be in the format 20XX-XXX (e.g. 2000-000).');
      return;
    }
    if (inventoryControlNumber && !ICN_PATTERN.test(inventoryControlNumber)) {
      setError(
        'Inventory Control No. must be in the format XXXXXXXX-XXXXXXX (e.g. 12345678-1234567).',
      );
      return;
    }
    if (lastFourDigits && !/^\d{4}$/.test(lastFourDigits)) {
      setError('Last 4 digits must be exactly 4 numbers.');
      return;
    }
    const parsedLoadBalance = loadBalance ? parseFloat(loadBalance) : undefined;
    if (loadBalance && (Number.isNaN(parsedLoadBalance) || parsedLoadBalance! < 0)) {
      setError('Enter a valid load balance.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateDebitCardSettings({
        projectId: projectId.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        inventoryControlNumber: inventoryControlNumber.trim() || undefined,
        lastFourDigits: lastFourDigits.trim() || undefined,
        loadBalance: parsedLoadBalance,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      titleId="debit-card-settings-title"
      title="SOFO / Cashier's Office Settings"
    >
      <p className={styles['wl-settings-hint']}>
        Used to pre-fill the official SOFO debit card reconciliation form.
      </p>

      <div className={styles['wl-settings-section']}>
        <h3 className={styles['wl-settings-section-title']}>SOFO Settings</h3>

        <div className="wl-form-group">
          <label className="wl-form-label" htmlFor="sofo-project-id">
            Project ID
          </label>
          <input
            id="sofo-project-id"
            type="text"
            inputMode="numeric"
            className="wl-form-input"
            value={projectId}
            placeholder="70000000"
            onChange={handleProjectIdChange}
          />
        </div>

        <div className="wl-form-group">
          <label className="wl-form-label" htmlFor="sofo-account-number">
            Account No.
          </label>
          <input
            id="sofo-account-number"
            type="text"
            inputMode="numeric"
            className="wl-form-input"
            value={accountNumber}
            placeholder="2000-000"
            onChange={handleAccountNumberChange}
          />
        </div>

        <div className="wl-form-group">
          <label className="wl-form-label" htmlFor="sofo-icn">
            Inventory Control No.
          </label>
          <input
            id="sofo-icn"
            type="text"
            inputMode="numeric"
            className="wl-form-input"
            value={inventoryControlNumber}
            placeholder="12345678-1234567"
            onChange={handleInventoryControlNumberChange}
          />
        </div>
      </div>

      <div className={styles['wl-settings-section']}>
        <h3 className={styles['wl-settings-section-title']}>Cashier&apos;s Office</h3>

        <div className="wl-form-group">
          <label className="wl-form-label" htmlFor="debit-card-last-four">
            Last 4 Digits of Card
          </label>
          <input
            id="debit-card-last-four"
            type="text"
            inputMode="numeric"
            maxLength={4}
            className="wl-form-input"
            value={lastFourDigits}
            placeholder="1234"
            onChange={(e) => setLastFourDigits(e.target.value.replace(/\D/g, ''))}
          />
        </div>

        <div className="wl-form-group">
          <label className="wl-form-label" htmlFor="debit-card-load-balance">
            Load Balance
          </label>
          <input
            id="debit-card-load-balance"
            type="text"
            inputMode="decimal"
            className="wl-form-input"
            value={loadBalance}
            placeholder="0.00"
            onChange={(e) => setLoadBalance(e.target.value)}
          />
          <p className={styles['wl-settings-hint']}>
            The card&apos;s fixed limit (the max amount ever on the card), not its current
            balance.
          </p>
        </div>
      </div>

      {error && (
        <div className={`wl-form-error ${styles['wl-settings-error']}`}>{error}</div>
      )}

      <div className={styles['wl-settings-actions']}>
        <button
          type="button"
          className="wl-btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className="wl-btn-cancel"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
};
