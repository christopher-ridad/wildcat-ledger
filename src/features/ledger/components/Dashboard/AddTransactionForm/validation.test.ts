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
    ['3125551234', false],
    ['(312) 555-1234', false],
    ['+1 312-555-1234', false],
    ['not-an-email', false],
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
    'Journal',
  ] as const)('%s maps to the selected funding line', (type) => {
    expect(deriveBudgetLine(type, 'Operating')).toBe('Operating');
  });
});

describe('deriveDirection', () => {
  test('Journal is an Inflow', () => {
    expect(deriveDirection('Journal')).toBe('Inflow');
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
    test('saves without any documents attached', () => {
      const form = { ...baseForm, type: 'Payment Request' as const };
      expect(validateTransactionForm(form, false, undefined)).toBeNull();
    });

    test('saves an individual vendor without any documents attached', () => {
      const form = {
        ...baseForm,
        type: 'Payment Request' as const,
        isIndividualVendor: true,
      };
      expect(validateTransactionForm(form, false, undefined)).toBeNull();
    });

    test('existing vendors require a vendor number', () => {
      const form = {
        ...baseForm,
        type: 'Payment Request' as const,
        isExistingVendor: true,
        existingVendorNumber: '  ',
      };
      expect(validateTransactionForm(form, false, undefined)).toBe(
        'Enter the vendor number from the Existing Vendor List.',
      );
    });

    test('passes for an existing vendor with a vendor number', () => {
      const form = {
        ...baseForm,
        type: 'Payment Request' as const,
        isExistingVendor: true,
        existingVendorNumber: '12345',
      };
      expect(validateTransactionForm(form, false, undefined)).toBeNull();
    });
  });

  describe('Payment to NU Employee', () => {
    test('saves without any documents attached', () => {
      const form = { ...baseForm, type: 'Payment to NU Employee' as const };
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
        /Zelle email is required/,
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

  test('Journal requires only title and amount', () => {
    const form = { ...baseForm, type: 'Journal' as const, receiptFile: null };
    expect(validateTransactionForm(form, false, undefined)).toBeNull();
  });
});
