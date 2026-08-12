import { client, required, run } from './_client';

const c = client();
const keyType = required('CBS_QUERY_KEY_TYPE');
const keyValue = required('CBS_QUERY_KEY_VALUE');
const keys = {
  primaryIdentity: { primaryIdentity: keyValue },
  customerKey: { customerKey: keyValue },
  customerCode: { customerCode: keyValue },
  subscriberKey: { subscriberKey: keyValue },
  accountKey: { accountKey: keyValue },
  accountCode: { accountCode: keyValue },
} as const;

if (!(keyType in keys)) throw new Error(`Unsupported CBS_QUERY_KEY_TYPE: ${keyType}`);
await run('QueryCustomerInfoByKey', () =>
  c.queryCustomerInfoByKey(keys[keyType as keyof typeof keys]),
);
