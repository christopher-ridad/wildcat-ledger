import { describe, expect, test } from 'vitest';

import { Transaction } from '../../../types';
import { FormState } from './types';
import {
  AMOUNT_REGEX,
  deriveBudgetLine,
  deriveDirection,
  validateTransactionForm,
  ZELLE_REGEX,
} from './validation';

const baseForm: FormState = {
  title: 'Pizza',
  date: '2026-01-15',
  amount: '12.50',
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

const receiptFile = new File(['x'], 'receipt.png', { type: 'image/png' });

describe('AMOUNT_REGEX', () => {
  test.each([
    ['12.50', true],
    ['12', true],
    ['0.5', true],
    ['12.5', true],
    ['-12.50', false],
    ['12.500', false],
    ['1e5', false],
    ['abc', false],
    ['', false],
  ])('%s -> %s', (input, expected) => {
    expect(AMOUNT_REGEX.test(input)).toBe(expected);
  });
});

describe('ZELLE_REGEX', () => {
  test.each([
    ['person@example.com', true],
    ['3125551234', true],
    ['(312) 555-1234', true],
    ['+1 312-555-1234', true],
    ['not-an-email-or-phone', false],
    ['12345', false],
  ])('%s -> %s', (input, expected) => {
    expect(ZELLE_REGEX.test(input)).toBe(expected);
  });
});

describe('deriveBudgetLine', () => {
  test('Debit Card always maps to Debit Card regardless of funding', () => {
    expect(deriveBudgetLine('Debit Card', 'Gifts')).toBe('Debit Card');
    expect(deriveBudgetLine('Debit Card', 'ASG')).toBe('Debit Card');
  });

  test.each([
    'Payment Request',
    'Non-Officer Reimbursement',
    'Payment to NU Employee',
    'Deposit',
  ] as const)('%s maps to the selected funding line', (type) => {
    expect(deriveBudgetLine(type, 'Operating')).toBe('Operating');
  });
});

describe('deriveDirection', () => {
  test('Deposit is an Inflow', () => {
    expect(deriveDirection('Deposit')).toBe('Inflow');
  });

  test.each([
    'Debit Card',
    'Payment Request',
    'Non-Officer Reimbursement',
    'Payment to NU Employee',
  ] as const)('%s is an Outflow', (type) => {
    expect(deriveDirection(type)).toBe('Outflow');
  });
});

describe('validateTransactionForm', () => {
  test('requires a title', () => {
    const form = { ...baseForm, title: '  ', receiptFile };
    expect(validateTransactionForm(form, false, undefined)).toBe('Title is required.');
  });

  test('requires a valid positive amount', () => {
    const form = { ...baseForm, amount: '0', receiptFile };
    expect(validateTransactionForm(form, false, undefined)).toMatch(
      /valid dollar amount/,
    );
  });

  test('rejects negative and malformed amounts', () => {
    const form = { ...baseForm, amount: '-5', receiptFile };
    expect(validateTransactionForm(form, false, undefined)).toMatch(
      /valid dollar amount/,
    );
  });

  describe('Debit Card', () => {
    test('requires a receipt or an acknowledgment', () => {
      const form = {
        ...baseForm,
        type: 'Debit Card' as const,
        receiptFile: null,
      };
      expect(validateTransactionForm(form, false, undefined)).toMatch(/Upload a receipt/);
    });

    test('passes with a receipt file', () => {
      const form = { ...baseForm, type: 'Debit Card' as const, receiptFile };
      expect(validateTransactionForm(form, false, undefined)).toBeNull();
    });

    test('passes with noReceiptAcknowledged', () => {
      const form = {
        ...baseForm,
        type: 'Debit Card' as const,
        receiptFile: null,
        noReceiptAcknowledged: true,
      };
      expect(validateTransactionForm(form, false, undefined)).toBeNull();
    });

    test('passes when editing and an existing receipt is already attached', () => {
      const form = {
        ...baseForm,
        type: 'Debit Card' as const,
        receiptFile: null,
      };
      const existing: Transaction = {
        id: 'txn-1',
        title: 'Pizza',
        amount: 12.5,
        direction: 'Outflow',
        type: 'Debit Card',
        budgetLine: 'Debit Card',
        notes: '',
        receiptFileUrl: 'orgs/org-1/txn-1/receipt.png',
      };
      expect(validateTransactionForm(form, true, existing)).toBeNull();
    });
  });

  describe('Payment Request', () => {
    const contractFile = new File(['x'], 'contract.pdf', { type: 'application/pdf' });
    const w9File = new File(['x'], 'w9.pdf', { type: 'application/pdf' });

    test('requires a contract when creating', () => {
      const form = {
        ...baseForm,
        type: 'Payment Request' as const,
        contractFile: null,
        w9File,
      };
      expect(validateTransactionForm(form, false, undefined)).toMatch(/RSO Agreement/);
    });

    test('passes when the contract is acknowledged missing', () => {
      const form = {
        ...baseForm,
        type: 'Payment Request' as const,
        contractFile: null,
        contractAcknowledgedMissing: true,
        w9File,
      };
      expect(validateTransactionForm(form, false, undefined)).toBeNull();
    });

    test('requires a W-9 when creating', () => {
      const form = {
        ...baseForm,
        type: 'Payment Request' as const,
        contractFile,
        w9File: null,
      };
      expect(validateTransactionForm(form, false, undefined)).toMatch(/W-9/);
    });

    test('does not require contract/W-9 when editing', () => {
      const form = {
        ...baseForm,
        type: 'Payment Request' as const,
        contractFile: null,
        w9File: null,
      };
      expect(validateTransactionForm(form, true, undefined)).toBeNull();
    });

    test('individual vendors additionally require contracted services and conflict of interest forms', () => {
      const form = {
        ...baseForm,
        type: 'Payment Request' as const,
        contractFile,
        w9File,
        isIndividualVendor: true,
        contractedServicesFile: null,
        conflictOfInterestFile: null,
      };
      expect(validateTransactionForm(form, false, undefined)).toMatch(
        /Contracted Services Form/,
      );
    });

    test('individual-vendor requirements can be acknowledged missing', () => {
      const form = {
        ...baseForm,
        type: 'Payment Request' as const,
        contractFile,
        w9File,
        isIndividualVendor: true,
        contractedServicesFile: null,
        contractedServicesAcknowledgedMissing: true,
        conflictOfInterestFile: null,
        conflictOfInterestAcknowledgedMissing: true,
      };
      expect(validateTransactionForm(form, false, undefined)).toBeNull();
    });

    test('passes once all individual-vendor documents are provided', () => {
      const csFile = new File(['x'], 'cs.pdf', { type: 'application/pdf' });
      const coiFile = new File(['x'], 'coi.pdf', { type: 'application/pdf' });
      const form = {
        ...baseForm,
        type: 'Payment Request' as const,
        contractFile,
        w9File,
        isIndividualVendor: true,
        contractedServicesFile: csFile,
        conflictOfInterestFile: coiFile,
      };
      expect(validateTransactionForm(form, false, undefined)).toBeNull();
    });

    test('passes for a non-individual vendor with contract and W-9', () => {
      const form = {
        ...baseForm,
        type: 'Payment Request' as const,
        contractFile,
        w9File,
      };
      expect(validateTransactionForm(form, false, undefined)).toBeNull();
    });
  });

  describe('Payment to NU Employee', () => {
    const contractFile = new File(['x'], 'contract.pdf', { type: 'application/pdf' });
    const w9File = new File(['x'], 'w9.pdf', { type: 'application/pdf' });
    const specialPayFormFile = new File(['x'], 'special-pay.pdf', {
      type: 'application/pdf',
    });

    test('requires a contract when creating', () => {
      const form = {
        ...baseForm,
        type: 'Payment to NU Employee' as const,
        contractFile: null,
        w9File,
        specialPayFormFile,
      };
      expect(validateTransactionForm(form, false, undefined)).toMatch(/RSO Agreement/);
    });

    test('requires a W-9 when creating', () => {
      const form = {
        ...baseForm,
        type: 'Payment to NU Employee' as const,
        contractFile,
        w9File: null,
        specialPayFormFile,
      };
      expect(validateTransactionForm(form, false, undefined)).toMatch(/W-9/);
    });

    test('requires the Special Pay Form when creating', () => {
      const form = {
        ...baseForm,
        type: 'Payment to NU Employee' as const,
        contractFile,
        w9File,
        specialPayFormFile: null,
      };
      expect(validateTransactionForm(form, false, undefined)).toMatch(/Special Pay Form/);
    });

    test('passes once all three are acknowledged missing', () => {
      const form = {
        ...baseForm,
        type: 'Payment to NU Employee' as const,
        contractFile: null,
        contractAcknowledgedMissing: true,
        w9File: null,
        w9AcknowledgedMissing: true,
        specialPayFormFile: null,
        specialPayFormAcknowledgedMissing: true,
      };
      expect(validateTransactionForm(form, false, undefined)).toBeNull();
    });

    test('does not require documents when editing', () => {
      const form = {
        ...baseForm,
        type: 'Payment to NU Employee' as const,
        contractFile: null,
        w9File: null,
        specialPayFormFile: null,
      };
      expect(validateTransactionForm(form, true, undefined)).toBeNull();
    });

    test('passes once contract, W-9, and Special Pay Form are all provided', () => {
      const form = {
        ...baseForm,
        type: 'Payment to NU Employee' as const,
        contractFile,
        w9File,
        specialPayFormFile,
      };
      expect(validateTransactionForm(form, false, undefined)).toBeNull();
    });
  });

  describe('Non-Officer Reimbursement', () => {
    test('requires the name of the member being reimbursed', () => {
      const form = {
        ...baseForm,
        type: 'Non-Officer Reimbursement' as const,
        receiptFile,
        zelleInfo: 'person@example.com',
        reimbursedMemberName: '  ',
      };
      expect(validateTransactionForm(form, false, undefined)).toMatch(
        /member being reimbursed/,
      );
    });

    test('requires a receipt or an acknowledgment when creating', () => {
      const form = {
        ...baseForm,
        type: 'Non-Officer Reimbursement' as const,
        receiptFile: null,
        zelleInfo: 'person@example.com',
        reimbursedMemberName: 'Jane Doe',
      };
      expect(validateTransactionForm(form, false, undefined)).toMatch(/Upload a receipt/);
    });

    test('passes when the receipt is acknowledged missing', () => {
      const form = {
        ...baseForm,
        type: 'Non-Officer Reimbursement' as const,
        receiptFile: null,
        noReceiptAcknowledged: true,
        zelleInfo: 'person@example.com',
        reimbursedMemberName: 'Jane Doe',
      };
      expect(validateTransactionForm(form, false, undefined)).toBeNull();
    });

    test('requires Zelle info', () => {
      const form = {
        ...baseForm,
        type: 'Non-Officer Reimbursement' as const,
        receiptFile,
        zelleInfo: '',
        reimbursedMemberName: 'Jane Doe',
      };
      expect(validateTransactionForm(form, false, undefined)).toMatch(
        /Zelle information/,
      );
    });

    test('rejects invalid Zelle info', () => {
      const form = {
        ...baseForm,
        type: 'Non-Officer Reimbursement' as const,
        receiptFile,
        zelleInfo: 'not valid',
        reimbursedMemberName: 'Jane Doe',
      };
      expect(validateTransactionForm(form, false, undefined)).toMatch(/valid Zelle/);
    });

    test('passes with a member name, a receipt, and a valid Zelle email', () => {
      const form = {
        ...baseForm,
        type: 'Non-Officer Reimbursement' as const,
        receiptFile,
        zelleInfo: 'person@example.com',
        reimbursedMemberName: 'Jane Doe',
      };
      expect(validateTransactionForm(form, false, undefined)).toBeNull();
    });
  });

  test('Deposit requires only title and amount', () => {
    const form = { ...baseForm, type: 'Deposit' as const, receiptFile: null };
    expect(validateTransactionForm(form, false, undefined)).toBeNull();
  });
});
