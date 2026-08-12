import { client, required, run } from './_client';

const c = client();
await run('AdjustSecurityDepositOrInitialBalance', () =>
  c.adjustAccount(required('MSISDN'), {
    adjustmentAmt: required('CBS_ADJUSTMENT_AMOUNT'),
    balanceType: process.env.CBS_BALANCE_TYPE ?? 'C_MAIN_ACCOUNT',
    adjustmentType: process.env.CBS_ADJUSTMENT_TYPE ?? '2',
    currencyId: process.env.CBS_CURRENCY_ID ?? '1054',
    adjustmentReasonCode: process.env.CBS_ADJUSTMENT_REASON_CODE ?? 'DNTREQ',
    opType: process.env.CBS_ADJUSTMENT_OP_TYPE ?? '2',
  }),
);
