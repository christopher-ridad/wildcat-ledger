import { Funding, Transaction, TransactionType } from '../../../types';

export type SupportedType = Extract<
  TransactionType,
  | 'Debit Card'
  | 'Payment Request'
  | 'Non-Officer Reimbursement'
  | 'Payment to NU Employee'
  | 'Deposit'
>;

export type FundingOption = Funding;

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
  contractAcknowledgedMissing: boolean;
  w9File: File | null;
  w9AcknowledgedMissing: boolean;
  isIndividualVendor: boolean;
  contractedServicesFile: File | null;
  contractedServicesAcknowledgedMissing: boolean;
  conflictOfInterestFile: File | null;
  conflictOfInterestAcknowledgedMissing: boolean;
  specialPayFormFile: File | null;
  specialPayFormAcknowledgedMissing: boolean;
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
  contractAcknowledgedMissing: false,
  w9File: null,
  w9AcknowledgedMissing: false,
  isIndividualVendor: false,
  contractedServicesFile: null,
  contractedServicesAcknowledgedMissing: false,
  conflictOfInterestFile: null,
  conflictOfInterestAcknowledgedMissing: false,
  specialPayFormFile: null,
  specialPayFormAcknowledgedMissing: false,
  zelleInfo: '',
  reimbursedMemberName: '',
  notes: '',
};
