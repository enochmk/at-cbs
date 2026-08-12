import { client, required, run } from './_client';

const c = client();
await run('ChangeAccountCreditLimit', () =>
  c.changeAccountCreditLimit({
    accountKey: process.env.CBS_ACCOUNT_KEY,
    accountCode: process.env.CBS_ACCOUNT_CODE,
    primaryIdentity: process.env.MSISDN,
    creditLimitType: process.env.CBS_CREDIT_LIMIT_TYPE,
    newLimitAmount: required('CBS_NEW_CREDIT_LIMIT'),
    effectiveTime: process.env.CBS_EFFECTIVE_TIME,
  }),
);
