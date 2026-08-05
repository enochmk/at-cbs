import test from 'node:test';
import assert from 'node:assert/strict';

import { addAmountInGhc, normalizeBalanceAmount } from '../src/utils';

test('converts CBS balance units to Ghana cedis', () => {
  assert.equal(normalizeBalanceAmount(100_000), 1);
  assert.equal(normalizeBalanceAmount('250000'), 2.5);
  assert.equal(normalizeBalanceAmount(undefined), undefined);
});

test('adds amountInGhc without changing the original balance fields', () => {
  const balanceChanges = {
    AcctBalanceChange: [{ BalanceType: 'C_MAIN_ACCOUNT', BalanceAfterChange: 350_000 }],
  };

  const result = addAmountInGhc(balanceChanges);

  assert.equal(result.AcctBalanceChange[0].BalanceAfterChange, 350_000);
  assert.equal((result.AcctBalanceChange[0] as Record<string, unknown>).amountInGhc, 3.5);
  assert.equal(
    (balanceChanges.AcctBalanceChange[0] as Record<string, unknown>).amountInGhc,
    undefined,
  );
});
