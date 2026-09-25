import { describe, expect, test } from 'vitest';

import { getRequiredDocuments } from '../../ledger/utils/documentRequirements';
import { requirementSeedsForTask } from './financialTaskRequirements';

describe('requirementSeedsForTask', () => {
  test('returns an empty list when no payment type is given', () => {
    expect(requirementSeedsForTask({})).toEqual([]);
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
      const seeds = requirementSeedsForTask({
        paymentType: type,
        isIndividualVendor: individual,
        isExistingVendor: existing,
      });
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
    const notIndividual = requirementSeedsForTask({ paymentType: 'Payment Request' });
    const individual = requirementSeedsForTask({
      paymentType: 'Payment Request',
      isIndividualVendor: true,
    });
    expect(notIndividual.map((s) => s.key)).toEqual(['contract', 'w9']);
    expect(individual.map((s) => s.key)).toEqual([
      'contract',
      'w9',
      'contractedServices',
      'conflictOfInterest',
    ]);
  });

  test('an existing-vendor Payment Request only needs the contract', () => {
    const seeds = requirementSeedsForTask({
      paymentType: 'Payment Request',
      isIndividualVendor: true,
      isExistingVendor: true,
    });
    expect(seeds.map((s) => s.key)).toEqual(['contract']);
  });

  test('Journal has no requirements', () => {
    expect(requirementSeedsForTask({ paymentType: 'Journal' })).toEqual([]);
  });
});
