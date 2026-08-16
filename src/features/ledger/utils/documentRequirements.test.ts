import { describe, expect, test } from 'vitest';

import { buildMockTransaction } from '../../../test/mocks';
import { getMissingDocuments, getRequiredDocuments } from './documentRequirements';

describe('getRequiredDocuments', () => {
  test.each([
    ['Debit Card requires only a receipt', { type: 'Debit Card' }, ['receipt']],
    [
      'Non-Officer Reimbursement requires only a receipt',
      { type: 'Non-Officer Reimbursement' },
      ['receipt'],
    ],
    [
      'Payment Request requires contract and W-9 for a non-individual vendor',
      { type: 'Payment Request', isIndividualVendor: false },
      ['contract', 'w9'],
    ],
    [
      'Payment Request additionally requires CSF and COI for an individual vendor',
      { type: 'Payment Request', isIndividualVendor: true },
      ['contract', 'w9', 'contractedServices', 'conflictOfInterest'],
    ],
    [
      'Payment to NU Employee requires contract, W-9, and Special Pay Form',
      { type: 'Payment to NU Employee' },
      ['contract', 'w9', 'specialPayForm'],
    ],
    ['Deposit requires nothing', { type: 'Deposit' }, []],
  ] as const)('%s', (_description, overrides, expectedKeys) => {
    const t = buildMockTransaction(overrides);
    expect(getRequiredDocuments(t).map((d) => d.key)).toEqual(expectedKeys);
  });
});

describe('getMissingDocuments', () => {
  test('returns nothing once all required files are attached', () => {
    const t = buildMockTransaction({
      type: 'Payment Request',
      contractFileUrl: 'orgs/1/contract.pdf',
      w9FileUrl: 'orgs/1/w9.pdf',
    });
    expect(getMissingDocuments(t)).toEqual([]);
  });

  test('returns only the documents whose file is absent', () => {
    const t = buildMockTransaction({
      type: 'Payment Request',
      contractFileUrl: 'orgs/1/contract.pdf',
      w9FileUrl: undefined,
    });
    expect(getMissingDocuments(t).map((d) => d.key)).toEqual(['w9']);
  });

  test('a document acknowledged missing still counts as missing', () => {
    const t = buildMockTransaction({
      type: 'Payment to NU Employee',
      contractFileUrl: undefined,
      contractAcknowledgedMissing: true,
    });
    expect(getMissingDocuments(t).map((d) => d.key)).toContain('contract');
  });

  test('a Debit Card purchase with an exemption form but no receipt is not missing its receipt', () => {
    const t = buildMockTransaction({
      type: 'Debit Card',
      receiptFileUrl: undefined,
      exemptionFormUrl: 'orgs/1/exemption.pdf',
    });
    expect(getMissingDocuments(t)).toEqual([]);
  });

  test('a Debit Card purchase with neither a receipt nor an exemption form is missing its receipt', () => {
    const t = buildMockTransaction({
      type: 'Debit Card',
      receiptFileUrl: undefined,
      exemptionFormUrl: undefined,
    });
    expect(getMissingDocuments(t).map((d) => d.key)).toEqual(['receipt']);
  });

  test("an exemption form does not satisfy Non-Officer Reimbursement's receipt requirement", () => {
    const t = buildMockTransaction({
      type: 'Non-Officer Reimbursement',
      receiptFileUrl: undefined,
      exemptionFormUrl: 'orgs/1/exemption.pdf',
    });
    expect(getMissingDocuments(t).map((d) => d.key)).toEqual(['receipt']);
  });
});

describe('requestBehavior', () => {
  test('receipt, W-9, and Special Pay Form are simple requests', () => {
    const receipt = getRequiredDocuments(buildMockTransaction({ type: 'Debit Card' }))[0];
    const [, w9] = getRequiredDocuments(
      buildMockTransaction({ type: 'Payment Request' }),
    );
    const [, , specialPayForm] = getRequiredDocuments(
      buildMockTransaction({ type: 'Payment to NU Employee' }),
    );
    expect(receipt.requestBehavior).toBe('simple');
    expect(w9.requestBehavior).toBe('simple');
    expect(specialPayForm.requestBehavior).toBe('simple');
  });

  test('contract and Contracted Services Form require preparation first', () => {
    const [contract] = getRequiredDocuments(
      buildMockTransaction({ type: 'Payment Request' }),
    );
    const [, , contractedServices] = getRequiredDocuments(
      buildMockTransaction({ type: 'Payment Request', isIndividualVendor: true }),
    );
    expect(contract.requestBehavior).toBe('prepareFirst');
    expect(contractedServices.requestBehavior).toBe('prepareFirst');
  });

  test('Conflict of Interest Form cannot be requested', () => {
    const [, , , conflictOfInterest] = getRequiredDocuments(
      buildMockTransaction({ type: 'Payment Request', isIndividualVendor: true }),
    );
    expect(conflictOfInterest.requestBehavior).toBe('none');
  });
});
