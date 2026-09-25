import { describe, expect, test } from 'vitest';

import { getRequiredDocuments } from '../../ledger/utils/documentRequirements';
import { requirementSeedsForPaymentType } from './financialTaskRequirements';

describe('requirementSeedsForPaymentType', () => {
  test('returns an empty list when no payment type is given', () => {
    expect(requirementSeedsForPaymentType(undefined, false, false)).toEqual([]);
  });

  test('matches getRequiredDocuments for each payment type', () => {
    const types: {
      type: Parameters<typeof getRequiredDocuments>[0]['type'];
      individual: boolean;
      existing: boolean;
    }[] = [
      { type: 'Debit Card', individual: false, existing: false },
      { type: 'Non-Officer Reimbursement', individual: false, existing: false },
      { type: 'Payment Request', individual: false, existing: false },
      { type: 'Payment Request', individual: true, existing: false },
      { type: 'Payment Request', individual: false, existing: true },
      { type: 'Payment to NU Employee', individual: false, existing: false },
      { type: 'Journal', individual: false, existing: false },
    ];

    for (const { type, individual, existing } of types) {
      const seeds = requirementSeedsForPaymentType(type, individual, existing);
      const expected = getRequiredDocuments({
        type,
        isIndividualVendor: individual,
        isExistingVendor: existing,
      }).map((d) => ({
        key: d.key,
        label: d.label,
      }));
      expect(seeds).toEqual(expected);
    }
  });

  test('Payment Request differs based on isIndividualVendor', () => {
    const notIndividual = requirementSeedsForPaymentType('Payment Request', false, false);
    const individual = requirementSeedsForPaymentType('Payment Request', true, false);
    expect(notIndividual.map((s) => s.key)).toEqual(['contract', 'w9']);
    expect(individual.map((s) => s.key)).toEqual([
      'contract',
      'w9',
      'contractedServices',
      'conflictOfInterest',
    ]);
  });

  test('an existing-vendor Payment Request only needs the contract', () => {
    const seeds = requirementSeedsForPaymentType('Payment Request', true, true);
    expect(seeds.map((s) => s.key)).toEqual(['contract']);
  });

  test('Journal has no requirements', () => {
    expect(requirementSeedsForPaymentType('Journal', false, false)).toEqual([]);
  });
});
