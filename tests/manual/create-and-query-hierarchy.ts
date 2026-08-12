import { client, execute, required } from './_client';

const c = client();
const customerKey = required('CBS_CUSTOMER_KEY');
const accountKey = required('CBS_ACCOUNT_KEY');
const subscriberKey = required('CBS_SUBSCRIBER_KEY');
const primaryIdentity = required('MSISDN');
const paymentMode = Number(required('CBS_SUBSCRIBER_PAYMENT_MODE'));

if (![0, 1, 2].includes(paymentMode)) {
  throw new Error('CBS_SUBSCRIBER_PAYMENT_MODE must be 0, 1, or 2.');
}

console.log('This flow mutates CBS. Reuse only dedicated test identifiers.');

await execute('CreateCustomer', () =>
  c.createCustomer({
    registerCustKey: process.env.CBS_REGISTER_CUSTOMER_KEY ?? customerKey,
    customerKey,
    customerCode: process.env.CBS_CUSTOMER_CODE,
    customerType: process.env.CBS_CUSTOMER_TYPE ?? '1',
    customerNodeType: process.env.CBS_CUSTOMER_NODE_TYPE ?? '1',
    customerClass: process.env.CBS_CUSTOMER_CLASS ?? '1',
    customerSegment: process.env.CBS_CUSTOMER_SEGMENT,
    individual: process.env.CBS_CUSTOMER_FIRST_NAME
      ? {
          idType: process.env.CBS_CUSTOMER_ID_TYPE,
          idNumber: process.env.CBS_CUSTOMER_ID_NUMBER,
          firstName: process.env.CBS_CUSTOMER_FIRST_NAME,
          lastName: process.env.CBS_CUSTOMER_LAST_NAME,
          mobilePhone: process.env.CBS_CUSTOMER_MOBILE,
          email: process.env.CBS_CUSTOMER_EMAIL,
        }
      : undefined,
  }),
);

await execute('QueryCustomerAfterCreate', () => c.queryCustomerInfoByKey({ customerKey }));

await execute('CreateAccount', () =>
  c.createAccount({
    registerCustKey: process.env.CBS_REGISTER_CUSTOMER_KEY ?? customerKey,
    accountKey,
    accountCode: process.env.CBS_ACCOUNT_CODE,
    userCustomerKey: customerKey,
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

await execute('QueryAccountAfterCreate', () => c.queryCustomerInfoByKey({ accountKey }));

await execute('CreateSubscriberForAccount', () =>
  c.createSubscriberForAccount({
    customerKey,
    accountKey,
    subscriberKey,
    primaryIdentity,
    secondaryIdentity: process.env.CBS_SECONDARY_IDENTITY,
    paymentMode: paymentMode as 0 | 1 | 2,
    offeringId: required('CBS_OFFERING_ID'),
    offeringClass: process.env.CBS_OFFERING_CLASS,
    subscriberClass: process.env.CBS_SUBSCRIBER_CLASS,
    status: process.env.CBS_SUBSCRIBER_STATUS ?? '1',
    initialBalance: process.env.CBS_INITIAL_BALANCE,
    creditLimit: process.env.CBS_CREDIT_LIMIT,
  }),
);

await execute('QuerySubscriberAfterCreate', () => c.queryCustomerInfoByKey({ subscriberKey }));
