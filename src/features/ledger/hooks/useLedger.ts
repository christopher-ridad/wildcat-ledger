import { useContext } from 'react';

import { LedgerContext } from '../stores/LedgerContext';
import { LedgerContextValue } from '../types';

export const useLedger = (): LedgerContextValue => {
  const context = useContext(LedgerContext);
  if (context === undefined) {
    throw new Error('useLedger must be used within a LedgerProvider');
  }
  return context;
};
