import { describe, expect, test } from 'vitest';

import { getRequiredDocuments } from './documentRequirements';
import { requirementSeedsForPaymentType } from './financialTaskRequirements';

describe('requirementSeedsForPaymentType', () => {
  test('returns an empty list when no payment type is given', () => {
    expect(requirementSeedsForPaymentType(undefined, false)).toEqual([]);
  });

  test('matches getRequiredDocuments for each payment type', () => {
    const types: {
      type: Parameters<typeof getRequiredDocuments>[0]['type'];
      individual: boolean;
    }[] = [
      { type: 'Debit Card', individual: false },
      { type: 'Non-Officer Reimbursement', individual: false },
      { type: 'Payment Request', individual: false },
      { type: 'Payment Request', individual: true },
      { type: 'Payment to NU Employee', individual: false },
      { type: 'Deposit', individual: false },
    ];

    for (const { type, individual } of types) {
      const seeds = requirementSeedsForPaymentType(type, individual);
      const expected = getRequiredDocuments({ type, isIndividualVendor: individual }).map(
        (d) => ({
          key: d.key,
          label: d.label,
        }),
      );
      expect(seeds).toEqual(expected);
    }
  });

  test('Payment Request differs based on isIndividualVendor', () => {
    const notIndividual = requirementSeedsForPaymentType('Payment Request', false);
    const individual = requirementSeedsForPaymentType('Payment Request', true);
    expect(notIndividual.map((s) => s.key)).toEqual(['contract', 'w9']);
    expect(individual.map((s) => s.key)).toEqual([
      'contract',
      'w9',
      'contractedServices',
      'conflictOfInterest',
    ]);
  });

  test('Deposit has no requirements', () => {
    expect(requirementSeedsForPaymentType('Deposit', false)).toEqual([]);
  });
});
