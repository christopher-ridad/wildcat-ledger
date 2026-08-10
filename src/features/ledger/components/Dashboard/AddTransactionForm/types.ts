import { Transaction, TransactionType } from '../../../types';

export type SupportedType = Extract<
  TransactionType,
  'Debit card purchase' | 'Direct payment' | 'Reimbursement' | 'Deposit'
>;

export type FundingOption = 'ASG' | 'Operating' | 'Gifts';

export interface AddTransactionFormProps {
  onSuccess?: () => void;
  existingTransaction?: Transaction;
}

export interface FormState {
  title: string;
  date: string;
  amount: string;
  type: SupportedType;
  funding: FundingOption;
  // Debit card purchase
  receiptFile: File | null;
  noReceiptAcknowledged: boolean;
  // Direct payment
  contractFile: File | null;
  w9File: File | null;
  isIndividualVendor: boolean;
  contractedServicesFile: File | null;
  conflictOfInterestFile: File | null;
  // Reimbursement
  zelleInfo: string;
  reimbursedMemberName: string;
  notes: string;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const initialForm: FormState = {
  title: '',
  date: todayISO(),
  amount: '',
  type: 'Debit card purchase',
  funding: 'ASG',
  receiptFile: null,
  noReceiptAcknowledged: false,
  contractFile: null,
  w9File: null,
  isIndividualVendor: false,
  contractedServicesFile: null,
  conflictOfInterestFile: null,
  zelleInfo: '',
  reimbursedMemberName: '',
  notes: '',
};
