import { Funding, Transaction, TransactionType } from '../../../types';

// The transaction types this form knows how to build/edit -- deliberately a
// curated subset of TransactionType, not an alias for it, so a type added
// there later doesn't silently become selectable here before this form
// actually supports it.
export const SUPPORTED_TYPES = [
  'Debit Card',
  'Payment Request',
  'Non-Officer Reimbursement',
  'Payment to NU Employee',
  'Journal',
] as const satisfies readonly TransactionType[];

export type SupportedType = (typeof SUPPORTED_TYPES)[number];

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
  contractNotStored: boolean;
  w9File: File | null;
  w9NotStored: boolean;
  isIndividualVendor: boolean;
  isExistingVendor: boolean;
  existingVendorNumber: string;
  contractedServicesFile: File | null;
  contractedServicesNotStored: boolean;
  conflictOfInterestFile: File | null;
  conflictOfInterestNotStored: boolean;
  specialPayFormFile: File | null;
  specialPayFormNotStored: boolean;
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
  contractNotStored: false,
  w9File: null,
  w9NotStored: false,
  isIndividualVendor: false,
  isExistingVendor: false,
  existingVendorNumber: '',
  contractedServicesFile: null,
  contractedServicesNotStored: false,
  conflictOfInterestFile: null,
  conflictOfInterestNotStored: false,
  specialPayFormFile: null,
  specialPayFormNotStored: false,
  zelleInfo: '',
  reimbursedMemberName: '',
  notes: '',
};
