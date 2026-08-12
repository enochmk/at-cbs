import { client, required, run } from './_client';

const mode = Number(required('CBS_NEW_PAYMENT_MODE'));
if (![0, 1, 2].includes(mode)) throw new Error('CBS_NEW_PAYMENT_MODE must be 0, 1, or 2.');

const c = client();
await run('ChangeSubscriberPaymentMode', () =>
  c.changeSubscriberPaymentMode({
    subscriberKey: process.env.CBS_SUBSCRIBER_KEY,
    primaryIdentity: process.env.MSISDN,
    paymentMode: mode as 0 | 1 | 2,
    oldOfferingId: process.env.CBS_OLD_OFFERING_ID,
    newOfferingId: process.env.CBS_NEW_OFFERING_ID,
    accountKey: process.env.CBS_ACCOUNT_KEY,
    paymentRelationKey: process.env.CBS_PAYMENT_RELATION_KEY,
    initialBalance: process.env.CBS_INITIAL_BALANCE,
    creditLimit: process.env.CBS_CREDIT_LIMIT,
    effectiveTime: process.env.CBS_EFFECTIVE_TIME,
  }),
);
