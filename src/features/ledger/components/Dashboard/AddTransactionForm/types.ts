import { Transaction, TransactionType } from '../../../types';

export type SupportedType = Extract<
  TransactionType,
  | 'Debit Card'
  | 'Payment Request'
  | 'Non-Officer Reimbursement'
  | 'Payment to NU Employee'
  | 'Deposit'
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
  // Debit Card
  receiptFile: File | null;
  noReceiptAcknowledged: boolean;
  taxExemptFormSubmitted: boolean;
  taxAmount: string;
  // Payment Request / Payment to NU Employee
  contractFile: File | null;
  w9File: File | null;
  isIndividualVendor: boolean;
  contractedServicesFile: File | null;
  conflictOfInterestFile: File | null;
  specialPayFormFile: File | null;
  // Non-Officer Reimbursement
  zelleInfo: string;
  reimbursedMemberName: string;
  notes: string;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const initialForm: FormState = {
  title: '',
  date: todayISO(),
  amount: '',
  type: 'Debit Card',
  funding: 'ASG',
  receiptFile: null,
  noReceiptAcknowledged: false,
  taxExemptFormSubmitted: false,
  taxAmount: '',
  contractFile: null,
  w9File: null,
  isIndividualVendor: false,
  contractedServicesFile: null,
  conflictOfInterestFile: null,
  specialPayFormFile: null,
  zelleInfo: '',
  reimbursedMemberName: '',
  notes: '',
};
