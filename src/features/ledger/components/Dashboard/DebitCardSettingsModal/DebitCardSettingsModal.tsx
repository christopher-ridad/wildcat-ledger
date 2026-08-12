import { useEffect, useRef, useState } from 'react';

import { useLedger } from '../../../hooks/useLedger';
import styles from './DebitCardSettingsModal.module.css';

interface DebitCardSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DebitCardSettingsModal = ({
  isOpen,
  onClose,
}: DebitCardSettingsModalProps) => {
  const { activeOrganization, updateDebitCardSettings } = useLedger();
  const settings = activeOrganization?.debitCardSettings;

  const [accountNumber, setAccountNumber] = useState('');
  const [lastFourDigits, setLastFourDigits] = useState('');
  const [inventoryControlNumber, setInventoryControlNumber] = useState('');
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
      setAccountNumber(settings?.accountNumber ?? '');
      setLastFourDigits(settings?.lastFourDigits ?? '');
      setInventoryControlNumber(settings?.inventoryControlNumber ?? '');
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

  const handleSave = async () => {
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
        accountNumber: accountNumber.trim() || undefined,
        lastFourDigits: lastFourDigits.trim() || undefined,
        inventoryControlNumber: inventoryControlNumber.trim() || undefined,
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
            Debit Card Settings
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
            Used to pre-fill the official SOFO debit card reconciliation form. Only the
            last 4 digits of the card are stored, never the full number.
          </p>

          <div className="wl-form-group">
            <label className="wl-form-label" htmlFor="debit-card-account-number">
              Account Number
            </label>
            <input
              id="debit-card-account-number"
              type="text"
              className="wl-form-input"
              value={accountNumber}
              placeholder="20 XXXX-XXXX-XXX"
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </div>

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
            <label className="wl-form-label" htmlFor="debit-card-icn">
              Inventory Control Number
            </label>
            <input
              id="debit-card-icn"
              type="text"
              className="wl-form-input"
              value={inventoryControlNumber}
              onChange={(e) => setInventoryControlNumber(e.target.value)}
            />
          </div>

          <div className="wl-form-group">
            <label className="wl-form-label" htmlFor="debit-card-load-balance">
              Load Balance
            </label>
            <p className={styles['wl-settings-hint']}>
              The card&apos;s fixed limit (the max amount ever on the card), not its
              current balance.
            </p>
            <input
              id="debit-card-load-balance"
              type="text"
              inputMode="decimal"
              className="wl-form-input"
              value={loadBalance}
              placeholder="0.00"
              onChange={(e) => setLoadBalance(e.target.value)}
            />
          </div>

          {error && <div className="wl-form-error">{error}</div>}

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
