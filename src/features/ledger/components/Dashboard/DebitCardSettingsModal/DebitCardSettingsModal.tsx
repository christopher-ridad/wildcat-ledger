import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { useLedger } from '../../../hooks/useLedger';
import styles from './DebitCardSettingsModal.module.css';

interface DebitCardSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// "20" + 2 digits + "-" + 3 digits, e.g. 2000-000.
const ACCOUNT_NUMBER_PATTERN = /^20\d{2}-\d{3}$/;
// 8 digits + "-" + 7 digits, e.g. 12345678-1234567.
const ICN_PATTERN = /^\d{8}-\d{7}$/;

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

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAccountNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAccountNumber(formatWithDash(e.target.value, 4, 7));
  };

  const handleInventoryControlNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInventoryControlNumber(formatWithDash(e.target.value, 8, 15));
  };

  const handleSave = async () => {
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
    <div className="wl-modal-root">
      <div className="wl-modal-overlay" aria-hidden="true" onClick={onClose} />
      <div
        className="wl-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="debit-card-settings-title"
      >
        <div className="wl-modal-header">
          <h2 id="debit-card-settings-title" className="wl-modal-title">
            SOFO / Cashier&apos;s Office Settings
          </h2>
          <button
            type="button"
            className="wl-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="wl-modal-body">
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
                className="wl-form-input"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
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
                The card&apos;s fixed limit (the max amount ever on the card), not its
                current balance.
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
        </div>
      </div>
    </div>
  );
};
