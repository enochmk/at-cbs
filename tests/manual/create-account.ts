import { client, required, run } from './_client';

const c = client();
await run('CreateAccount', () =>
  c.createAccount({
    registerCustKey: required('CBS_REGISTER_CUSTOMER_KEY'),
    accountKey: required('CBS_ACCOUNT_KEY'),
    accountCode: process.env.CBS_ACCOUNT_CODE,
    userCustomerKey: required('CBS_CUSTOMER_KEY'),
    accountName: process.env.CBS_ACCOUNT_NAME,
    billCycleType: process.env.CBS_BILL_CYCLE_TYPE ?? '01',
    accountType: process.env.CBS_ACCOUNT_TYPE ?? '1',
    paymentType: process.env.CBS_PAYMENT_TYPE ?? '1',
    accountClass: process.env.CBS_ACCOUNT_CLASS ?? '1',
    currencyId: process.env.CBS_CURRENCY_ID ?? '1054',
    initialBalance: process.env.CBS_INITIAL_BALANCE,
    creditLimit: process.env.CBS_CREDIT_LIMIT,
    creditLimitType: process.env.CBS_CREDIT_LIMIT_TYPE,
    accountPaymentMethod: process.env.CBS_ACCOUNT_PAYMENT_METHOD,
  }),
);
