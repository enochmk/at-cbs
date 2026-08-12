import { client, required, run } from './_client';

const c = client();
await run('ChangePaymentRelation', () =>
  c.changePaymentRelation({
    subscriberKey: process.env.CBS_SUBSCRIBER_KEY,
    primaryIdentity: process.env.MSISDN,
    customerKey: process.env.CBS_CUSTOMER_KEY,
    customerCode: process.env.CBS_CUSTOMER_CODE,
    accountKey: process.env.CBS_ACCOUNT_KEY,
    addPayRelation: process.env.CBS_ADD_PAY_RELATION_KEY
      ? {
          payRelationKey: required('CBS_ADD_PAY_RELATION_KEY'),
          accountKey: process.env.CBS_PAYMENT_ACCOUNT_KEY,
          priority: process.env.CBS_PAY_RELATION_PRIORITY
            ? Number(process.env.CBS_PAY_RELATION_PRIORITY)
            : undefined,
          onlyPayRelationFlag: process.env.CBS_ONLY_PAY_RELATION_FLAG as 'Y' | 'N' | undefined,
        }
      : undefined,
    deletePayRelationKey: process.env.CBS_DELETE_PAY_RELATION_KEY,
  }),
);
