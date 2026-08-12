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
  type: 'Debit card purchase',
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
  isNorthwesternEmployee: false,
  specialPayFormFile: null,
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
  test('debit card purchase always maps to Debit Card regardless of funding', () => {
    expect(deriveBudgetLine('Debit card purchase', 'Gifts')).toBe('Debit Card');
    expect(deriveBudgetLine('Debit card purchase', 'ASG')).toBe('Debit Card');
  });

  test.each(['Direct payment', 'Reimbursement', 'Deposit'] as const)(
    '%s maps to the selected funding line',
    (type) => {
      expect(deriveBudgetLine(type, 'Operating')).toBe('Operating');
    },
  );
});

describe('deriveDirection', () => {
  test('Deposit is an Inflow', () => {
    expect(deriveDirection('Deposit')).toBe('Inflow');
  });

  test.each(['Debit card purchase', 'Direct payment', 'Reimbursement'] as const)(
    '%s is an Outflow',
    (type) => {
      expect(deriveDirection(type)).toBe('Outflow');
    },
  );
});

describe('validateTransactionForm', () => {
  test('requires a title', () => {
    const form = { ...baseForm, title: '  ', receiptFile };
    expect(validateTransactionForm(form, false, undefined, new Set())).toBe(
      'Title is required.',
    );
  });

  test('requires a valid positive amount', () => {
    const form = { ...baseForm, amount: '0', receiptFile };
    expect(validateTransactionForm(form, false, undefined, new Set())).toMatch(
      /valid dollar amount/,
    );
  });

  test('rejects negative and malformed amounts', () => {
    const form = { ...baseForm, amount: '-5', receiptFile };
    expect(validateTransactionForm(form, false, undefined, new Set())).toMatch(
      /valid dollar amount/,
    );
  });

  describe('Debit card purchase', () => {
    test('requires a receipt, request, or acknowledgment', () => {
      const form = {
        ...baseForm,
        type: 'Debit card purchase' as const,
        receiptFile: null,
      };
      expect(validateTransactionForm(form, false, undefined, new Set())).toMatch(
        /Upload a receipt/,
      );
    });

    test('passes with a receipt file', () => {
      const form = { ...baseForm, type: 'Debit card purchase' as const, receiptFile };
      expect(validateTransactionForm(form, false, undefined, new Set())).toBeNull();
    });

    test('passes with noReceiptAcknowledged', () => {
      const form = {
        ...baseForm,
        type: 'Debit card purchase' as const,
        receiptFile: null,
        noReceiptAcknowledged: true,
      };
      expect(validateTransactionForm(form, false, undefined, new Set())).toBeNull();
    });

    test('passes when receipt was requested via email', () => {
      const form = {
        ...baseForm,
        type: 'Debit card purchase' as const,
        receiptFile: null,
      };
      expect(
        validateTransactionForm(form, false, undefined, new Set(['receipt'])),
      ).toBeNull();
    });

    test('passes when editing and an existing receipt is already attached', () => {
      const form = {
        ...baseForm,
        type: 'Debit card purchase' as const,
        receiptFile: null,
      };
      const existing: Transaction = {
        id: 'txn-1',
        title: 'Pizza',
        amount: 12.5,
        direction: 'Outflow',
        type: 'Debit card purchase',
        budgetLine: 'Debit Card',
        notes: '',
        receiptFileUrl: 'orgs/org-1/txn-1/receipt.png',
      };
      expect(validateTransactionForm(form, true, existing, new Set())).toBeNull();
    });
  });

  describe('Direct payment', () => {
    const contractFile = new File(['x'], 'contract.pdf', { type: 'application/pdf' });
    const w9File = new File(['x'], 'w9.pdf', { type: 'application/pdf' });

    test('requires a contract when creating', () => {
      const form = {
        ...baseForm,
        type: 'Direct payment' as const,
        contractFile: null,
        w9File,
      };
      expect(validateTransactionForm(form, false, undefined, new Set())).toMatch(
        /RSO Agreement/,
      );
    });

    test('requires a W-9 when creating', () => {
      const form = {
        ...baseForm,
        type: 'Direct payment' as const,
        contractFile,
        w9File: null,
      };
      expect(validateTransactionForm(form, false, undefined, new Set())).toMatch(/W-9/);
    });

    test('does not require contract/W-9 when editing', () => {
      const form = {
        ...baseForm,
        type: 'Direct payment' as const,
        contractFile: null,
        w9File: null,
      };
      expect(validateTransactionForm(form, true, undefined, new Set())).toBeNull();
    });

    test('individual vendors additionally require contracted services and conflict of interest forms', () => {
      const form = {
        ...baseForm,
        type: 'Direct payment' as const,
        contractFile,
        w9File,
        isIndividualVendor: true,
        contractedServicesFile: null,
        conflictOfInterestFile: null,
      };
      expect(validateTransactionForm(form, false, undefined, new Set())).toMatch(
        /Contracted Services Form/,
      );
    });

    test('passes once all individual-vendor documents are provided', () => {
      const csFile = new File(['x'], 'cs.pdf', { type: 'application/pdf' });
      const coiFile = new File(['x'], 'coi.pdf', { type: 'application/pdf' });
      const form = {
        ...baseForm,
        type: 'Direct payment' as const,
        contractFile,
        w9File,
        isIndividualVendor: true,
        contractedServicesFile: csFile,
        conflictOfInterestFile: coiFile,
      };
      expect(validateTransactionForm(form, false, undefined, new Set())).toBeNull();
    });

    test('Northwestern employees additionally require the Special Pay Form', () => {
      const form = {
        ...baseForm,
        type: 'Direct payment' as const,
        contractFile,
        w9File,
        isNorthwesternEmployee: true,
        specialPayFormFile: null,
      };
      expect(validateTransactionForm(form, false, undefined, new Set())).toMatch(
        /Special Pay Form/,
      );
    });

    test('passes once the Special Pay Form is provided for a Northwestern employee', () => {
      const specialPayFormFile = new File(['x'], 'special-pay.pdf', {
        type: 'application/pdf',
      });
      const form = {
        ...baseForm,
        type: 'Direct payment' as const,
        contractFile,
        w9File,
        isNorthwesternEmployee: true,
        specialPayFormFile,
      };
      expect(validateTransactionForm(form, false, undefined, new Set())).toBeNull();
    });
  });

  describe('Reimbursement', () => {
    test('requires the name of the member being reimbursed', () => {
      const form = {
        ...baseForm,
        type: 'Reimbursement' as const,
        receiptFile,
        zelleInfo: 'person@example.com',
        reimbursedMemberName: '  ',
      };
      expect(validateTransactionForm(form, false, undefined, new Set())).toMatch(
        /member being reimbursed/,
      );
    });

    test('requires a receipt when creating', () => {
      const form = {
        ...baseForm,
        type: 'Reimbursement' as const,
        receiptFile: null,
        zelleInfo: 'person@example.com',
        reimbursedMemberName: 'Jane Doe',
      };
      expect(validateTransactionForm(form, false, undefined, new Set())).toMatch(
        /Upload a receipt photo/,
      );
    });

    test('requires Zelle info', () => {
      const form = {
        ...baseForm,
        type: 'Reimbursement' as const,
        receiptFile,
        zelleInfo: '',
        reimbursedMemberName: 'Jane Doe',
      };
      expect(validateTransactionForm(form, false, undefined, new Set())).toMatch(
        /Zelle information/,
      );
    });

    test('rejects invalid Zelle info', () => {
      const form = {
        ...baseForm,
        type: 'Reimbursement' as const,
        receiptFile,
        zelleInfo: 'not valid',
        reimbursedMemberName: 'Jane Doe',
      };
      expect(validateTransactionForm(form, false, undefined, new Set())).toMatch(
        /valid Zelle/,
      );
    });

    test('passes with a member name, a receipt, and a valid Zelle email', () => {
      const form = {
        ...baseForm,
        type: 'Reimbursement' as const,
        receiptFile,
        zelleInfo: 'person@example.com',
        reimbursedMemberName: 'Jane Doe',
      };
      expect(validateTransactionForm(form, false, undefined, new Set())).toBeNull();
    });
  });

  test('Deposit requires only title and amount', () => {
    const form = { ...baseForm, type: 'Deposit' as const, receiptFile: null };
    expect(validateTransactionForm(form, false, undefined, new Set())).toBeNull();
  });
});
