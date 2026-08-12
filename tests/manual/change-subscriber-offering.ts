import { client, required, run } from './_client';

const c = client();
await run('ChangeSubscriberOffering', () =>
  c.changeSubscriberOffering({
    subscriberKey: process.env.CBS_SUBSCRIBER_KEY,
    primaryIdentity: process.env.MSISDN,
    oldOfferingId: process.env.CBS_OLD_OFFERING_ID,
    newOfferingId: required('CBS_NEW_OFFERING_ID'),
    purchaseSeq: process.env.CBS_PURCHASE_SEQ,
    offeringClass: process.env.CBS_OFFERING_CLASS,
    effectiveTime: process.env.CBS_EFFECTIVE_TIME,
  }),
);
