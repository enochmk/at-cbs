import { client, required, run } from './_client';

const mode = Number(required('CBS_SUBSCRIBER_PAYMENT_MODE'));
if (![0, 1, 2].includes(mode)) throw new Error('CBS_SUBSCRIBER_PAYMENT_MODE must be 0, 1, or 2.');

const c = client();
await run('CreateSubscriberForAccount', () =>
  c.createSubscriberForAccount({
    customerKey: required('CBS_CUSTOMER_KEY'),
    accountKey: required('CBS_ACCOUNT_KEY'),
    subscriberKey: required('CBS_SUBSCRIBER_KEY'),
    primaryIdentity: required('MSISDN'),
    secondaryIdentity: process.env.CBS_SECONDARY_IDENTITY,
    paymentMode: mode as 0 | 1 | 2,
    offeringId: required('CBS_OFFERING_ID'),
    offeringClass: process.env.CBS_OFFERING_CLASS,
    subscriberClass: process.env.CBS_SUBSCRIBER_CLASS,
    status: process.env.CBS_SUBSCRIBER_STATUS ?? '1',
    initialBalance: process.env.CBS_INITIAL_BALANCE,
    creditLimit: process.env.CBS_CREDIT_LIMIT,
  }),
);
