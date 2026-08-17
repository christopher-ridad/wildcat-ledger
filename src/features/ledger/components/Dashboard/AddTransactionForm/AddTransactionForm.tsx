import styles from './AddTransactionForm.module.css';
import { DebitCardFields } from './DebitCardFields';
import { DirectPaymentFields } from './DirectPaymentFields';
import { NUEmployeePaymentFields } from './NUEmployeePaymentFields';
import { OverdraftWarning } from './OverdraftWarning';
import { ReimbursementFields } from './ReimbursementFields';
import { AddTransactionFormProps, FundingOption, todayISO } from './types';
import { useAddTransactionForm } from './useAddTransactionForm';

export const AddTransactionForm = (props: AddTransactionFormProps) => {
  const { existingTransaction } = props;
  const {
    form,
    isEditing,
    submitting,
    scanning,
    ocrError,
    error,
    overdraftWarning,
    pendingTransaction,
    handleReceiptChange,
    handleChange,
    handleTypeChange,
    handleSubmit,
    submitTransaction,
    cancelOverdraft,
  } = useAddTransactionForm(props);

  const showFunding =
    form.type === 'Payment Request' ||
    form.type === 'Non-Officer Reimbursement' ||
    form.type === 'Payment to NU Employee' ||
    form.type === 'Deposit';

  const fundingOptions: { value: FundingOption; label: string }[] =
    form.type === 'Deposit'
      ? [
          { value: 'Operating', label: 'Operations' },
          { value: 'Gifts', label: 'Gifts' },
        ]
      : [
          { value: 'ASG', label: 'ASG' },
          { value: 'Operating', label: 'Operations' },
          { value: 'Gifts', label: 'Gifts' },
        ];

  return (
    <form onSubmit={handleSubmit} className={styles['wl-form']} noValidate>
      <div className="wl-form-group">
        <label className="wl-form-label" htmlFor="title">
          Title <span className={styles['wl-form-required']}>*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          className="wl-form-input"
          value={form.title}
          onChange={handleChange}
          placeholder="e.g. DJ equipment rental"
        />
      </div>

      <div className="wl-form-group">
        <label className="wl-form-label" htmlFor="date">
          Date <span className={styles['wl-form-required']}>*</span>
        </label>
        <input
          id="date"
          name="date"
          type="date"
          className="wl-form-input"
          value={form.date}
          max={todayISO()}
          onChange={handleChange}
        />
      </div>

      <div className="wl-form-group">
        <label className="wl-form-label" htmlFor="amount">
          Amount ($) <span className={styles['wl-form-required']}>*</span>
        </label>
        <input
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          className="wl-form-input"
          value={form.amount}
          onChange={handleChange}
          placeholder="0.00"
        />
      </div>

      <div className="wl-form-group">
        <label className="wl-form-label" htmlFor="type">
          Transaction Type <span className={styles['wl-form-required']}>*</span>
        </label>
        <select
          id="type"
          name="type"
          className={styles['wl-form-select']}
          value={form.type}
          onChange={handleTypeChange}
        >
          <option value="Debit Card">Debit Card</option>
          <option value="Payment Request">Payment Request</option>
          <option value="Non-Officer Reimbursement">Non-Officer Reimbursement</option>
          <option value="Payment to NU Employee">Payment to NU Employee</option>
          <option value="Deposit">Deposit</option>
        </select>
      </div>

      <div className={styles['wl-form-section']}>
        {showFunding && (
          <div className="wl-form-group">
            <label className="wl-form-label" htmlFor="funding">
              Funding <span className={styles['wl-form-required']}>*</span>
            </label>
            <select
              id="funding"
              name="funding"
              className={styles['wl-form-select']}
              value={form.funding}
              onChange={handleChange}
            >
              {fundingOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {form.type === 'Debit Card' && (
          <DebitCardFields
            form={form}
            isEditing={isEditing}
            existingTransaction={existingTransaction}
            scanning={scanning}
            ocrError={ocrError}
            onReceiptChange={handleReceiptChange}
            onChange={handleChange}
          />
        )}

        {form.type === 'Payment Request' && (
          <DirectPaymentFields
            form={form}
            isEditing={isEditing}
            existingTransaction={existingTransaction}
            onChange={handleChange}
          />
        )}

        {form.type === 'Payment to NU Employee' && (
          <NUEmployeePaymentFields
            form={form}
            isEditing={isEditing}
            existingTransaction={existingTransaction}
            onChange={handleChange}
          />
        )}

        {form.type === 'Non-Officer Reimbursement' && (
          <ReimbursementFields
            form={form}
            isEditing={isEditing}
            existingTransaction={existingTransaction}
            scanning={scanning}
            ocrError={ocrError}
            onReceiptChange={handleReceiptChange}
            onChange={handleChange}
          />
        )}
      </div>

      <div className="wl-form-group">
        <label className="wl-form-label" htmlFor="notes">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          className={styles['wl-form-textarea']}
          value={form.notes}
          onChange={handleChange}
          rows={2}
          placeholder="Any additional context..."
        />
      </div>

      {error && (
        <div className="wl-form-error" role="alert">
          {error}
        </div>
      )}

      {overdraftWarning && pendingTransaction && (
        <OverdraftWarning
          message={overdraftWarning}
          submitting={submitting}
          onProceed={() =>
            submitTransaction(pendingTransaction.transaction, pendingTransaction.id)
          }
          onCancel={cancelOverdraft}
        />
      )}

      {!overdraftWarning && (
        <button type="submit" className="wl-btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Transaction'}
        </button>
      )}
    </form>
  );
};
