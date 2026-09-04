import { CbsClient, CbsRequestDefaults, type CreateSubscriberAccountOptions } from '../../src';

const PREPAID_MSISDN = process.env.CBS_PREPAID_MSISDN ?? '270118755';
const POSTPAID_MSISDN = process.env.CBS_POSTPAID_MSISDN ?? '261180254';
const HYBRID_MSISDN = process.env.CBS_HYBRID_MSISDN ?? '270105755';
const PREPAID_AMOUNT_GHC = Number(process.env.CBS_PREPAID_AMOUNT_GHC ?? 300);
const POSTPAID_LIMIT_GHC = Number(process.env.CBS_POSTPAID_LIMIT_GHC ?? 200);
const HYBRID_LIMIT_GHC = Number(process.env.CBS_HYBRID_LIMIT_GHC ?? 500);
const amountDivisor = Number(process.env.CBS_AMOUNT_DIVISOR ?? 100_000);

const prepaidOfferingId = process.env.CBS_PREPAID_OFFERING_ID ?? '2018105022';
const postpaidOfferingId = process.env.CBS_POSTPAID_OFFERING_ID ?? '2018105071';
const hybridOfferingId = process.env.CBS_HYBRID_OFFERING_ID ?? '2018105022';

const requiredEnvironment = ['CBS_BASE_URL', 'CBS_USERNAME', 'CBS_PASSWORD'] as const;
const missingEnvironment = requiredEnvironment.filter((key) => !process.env[key]);

if (!process.argv.includes('--execute')) {
  console.error('Refusing to change CBS state without --execute.');
  console.error(
    'Usage: CBS_BASE_URL=... CBS_USERNAME=... CBS_PASSWORD=... npm run test:create-container-flow -- --execute [--cleanup]',
  );
  process.exit(1);
}

if (missingEnvironment.length > 0) {
  throw new Error(`${missingEnvironment.join(', ')} are required`);
}

if (!Number.isFinite(amountDivisor) || amountDivisor <= 0) {
  throw new Error('CBS_AMOUNT_DIVISOR must be a positive number');
}

function cbsAmount(ghc: number): number {
  if (!Number.isFinite(ghc) || ghc < 0) throw new Error(`Invalid GHS amount: ${ghc}`);
  return Math.round(ghc * amountDivisor);
}

function messageSeq(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  return `${timestamp}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;
}

function account(
  accountKey: string,
  paymentType: 0 | 1,
  paymentRelationKey?: string,
  extra: Partial<CreateSubscriberAccountOptions> = {},
): CreateSubscriberAccountOptions {
  return {
    accountKey,
    accountCode: accountKey,
    paymentType,
    ...(paymentRelationKey ? { paymentRelationKey } : {}),
    ...extra,
  };
}

const cleanupNumbers = async (client: CbsClient) => {
  for (const msisdn of [PREPAID_MSISDN, POSTPAID_MSISDN, HYBRID_MSISDN]) {
    try {
      console.log(`Cleaning up ${msisdn}...`);
      const result = await client.deleteNumber(msisdn);
      console.log(`  cleanup result: ${JSON.stringify(result.data)}`);
    } catch (error) {
      console.warn(
        `  cleanup skipped for ${msisdn}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
};

const client = new CbsClient({
  baseUrl: process.env.CBS_BASE_URL!,
  username: process.env.CBS_USERNAME!,
  password: process.env.CBS_PASSWORD!,
  rejectUnauthorized: process.env.CBS_REJECT_UNAUTHORIZED !== 'false',
  logger: {
    verbose: (message, context) => console.log(message, context ?? ''),
    error: (message, context) => console.error(message, context ?? ''),
  },
});

if (process.argv.includes('--cleanup')) {
  await cleanupNumbers(client);
}

const suffix = Date.now().toString().slice(-10);
const customerKey = `${process.env.CBS_CUSTOMER_PREFIX ?? 'MK'}${suffix}`;
const prepaidCustomerKey = process.env.CBS_PREPAID_CUSTOMER_KEY ?? `${customerKey}-PRE-CUST`;
const mainAccountKey = process.env.CBS_MAIN_ACCOUNT_KEY ?? customerKey;
const prepaidAccountKey = process.env.CBS_PREPAID_ACCOUNT_KEY ?? `${customerKey}-PRE`;
const postpaidAccountKey = process.env.CBS_POSTPAID_ACCOUNT_KEY ?? `${customerKey}-POST`;
const hybridPrepaidAccountKey =
  process.env.CBS_HYBRID_PREPAID_ACCOUNT_KEY ?? `${customerKey}-H-PRE`;

const postpaidRelationKey = process.env.CBS_POSTPAID_RELATION_KEY ?? `${customerKey}-POST-REL`;
const hybridPrepaidRelationKey =
  process.env.CBS_HYBRID_PREPAID_RELATION_KEY ?? `${customerKey}-H-PRE-REL`;
const hybridPostpaidRelationKey =
  process.env.CBS_HYBRID_POSTPAID_RELATION_KEY ?? `${customerKey}-H-POST-REL`;

console.log('Container flow configuration:', {
  customerKey,
  mainAccountKey,
  prepaidCustomerKey,
  numbers: { prepaid: PREPAID_MSISDN, postpaid: POSTPAID_MSISDN, hybrid: HYBRID_MSISDN },
  amountsGhc: {
    prepaidInitialBalance: PREPAID_AMOUNT_GHC,
    postpaidLimit: POSTPAID_LIMIT_GHC,
    hybridLimit: HYBRID_LIMIT_GHC,
  },
  amountDivisor,
  offerings: { prepaidOfferingId, postpaidOfferingId, hybridOfferingId },
});

console.log('\n1. Create corporate customer and unlimited Main Account');
await client.createCustomer({
  messageSeq: messageSeq(),
  registerCustKey: customerKey,
  customerKey,
  customerCode: customerKey,
  customerType: 2,
  organization: {
    idType: process.env.CBS_ORGANIZATION_ID_TYPE ?? '1',
    idNumber: process.env.CBS_ORGANIZATION_ID_NUMBER ?? customerKey,
    shortName: process.env.CBS_ORGANIZATION_SHORT_NAME ?? 'MK',
    name: process.env.CBS_ORGANIZATION_NAME ?? `MK Container ${suffix}`,
  },
  defaultAccount: {
    paymentRelationKey: mainAccountKey,
    accountKey: mainAccountKey,
    account: {
      accountCode: mainAccountKey,
      billCycleType: '01',
      accountType: 1,
      paymentType: 1,
      creditLimitType: 'C_BILL_CYCLE_INITIAL_CREDIT',
      creditLimit: -1,
    },
  },
});

console.log('\n2. Create standalone prepaid subscriber without a corporate customer relationship');
await client.createSubscriber(PREPAID_MSISDN, {
  messageSeq: messageSeq(),
  paymentMode: 0,
  status: 2,
  registerCustomer: {
    opType: 1,
    customerKey: prepaidCustomerKey,
    customerType: 1,
    customerNodeType: 1,
    customerClass: 1,
    customerCode: prepaidCustomerKey,
  },
  subscriberKey: process.env.CBS_PREPAID_SUBSCRIBER_KEY ?? `SubKey${PREPAID_MSISDN}`,
  offeringId: prepaidOfferingId,
  accounts: [
    account(prepaidAccountKey, 0, undefined, {
      defaultAccount: true,
      initialBalance: cbsAmount(PREPAID_AMOUNT_GHC),
    }),
  ],
});

console.log('\n3. Create postpaid subscriber with an account credit limit of zero');
await client.createSubscriber(POSTPAID_MSISDN, {
  messageSeq: messageSeq(),
  customerKey,
  paymentMode: 1,
  status: 2,
  subscriberKey: process.env.CBS_POSTPAID_SUBSCRIBER_KEY ?? `SubKey${POSTPAID_MSISDN}`,
  offeringId: postpaidOfferingId,
  accounts: [
    account(postpaidAccountKey, 1, postpaidAccountKey, {
      creditLimitType: 'C_BILL_CYCLE_INITIAL_CREDIT',
      creditLimit: 0,
    }),
  ],
});

console.log('\n4. Add the Main Account payment relation and postpaid limit');
await client.changePaymentRelation({
  messageSeq: messageSeq(),
  primaryIdentity: POSTPAID_MSISDN,
  addPayRelation: {
    payRelationKey: postpaidRelationKey,
    accountKey: mainAccountKey,
    priority: Number(process.env.CBS_POSTPAID_RELATION_PRIORITY ?? 55),
    paymentLimitKey: postpaidRelationKey,
    expirationTime: process.env.CBS_PAYMENT_RELATION_EXPIRATION_TIME ?? '20370101000000',
  },
  paymentLimits: [
    {
      paymentLimitKey: postpaidRelationKey,
      limitCycleType: process.env.CBS_LIMIT_CYCLE_TYPE ?? 'B',
      limitType: process.env.CBS_LIMIT_TYPE ?? 'M',
      limitValueType: process.env.CBS_LIMIT_VALUE_TYPE ?? 'A',
      limitValue: cbsAmount(POSTPAID_LIMIT_GHC),
    },
  ],
});

console.log('\n5. Create hybrid subscriber with prepaid default account and Main Account');
await client.createSubscriber(HYBRID_MSISDN, {
  messageSeq: messageSeq(),
  customerKey,
  paymentMode: 2,
  status: 2,
  subscriberKey: process.env.CBS_HYBRID_SUBSCRIBER_KEY ?? `SubKey${HYBRID_MSISDN}`,
  offeringId: hybridOfferingId,
  accounts: [
    account(hybridPrepaidAccountKey, 0, hybridPrepaidRelationKey, {
      defaultAccount: true,
      priority: Number(process.env.CBS_HYBRID_PREPAID_PRIORITY ?? 50),
      initialBalance: 0,
    }),
    account(mainAccountKey, 1, hybridPostpaidRelationKey, {
      createAccount: false,
      defaultAccount: false,
      priority: Number(process.env.CBS_HYBRID_POSTPAID_PRIORITY ?? 55),
    }),
  ],
});

console.log('\n6. Set the hybrid Main Account payment limit');
await client.changePaymentRelation({
  messageSeq: messageSeq(),
  primaryIdentity: HYBRID_MSISDN,
  modifyPayRelation: {
    payRelationKey: hybridPostpaidRelationKey,
    paymentLimit: {
      operationType: Number(process.env.CBS_PAYMENT_LIMIT_OPERATION_TYPE ?? 1),
      paymentLimitKey: hybridPostpaidRelationKey,
      limitValue: cbsAmount(HYBRID_LIMIT_GHC),
    },
  },
  paymentLimits: [
    {
      paymentLimitKey: hybridPostpaidRelationKey,
      limitCycleType: process.env.CBS_LIMIT_CYCLE_TYPE ?? 'B',
      limitType: process.env.CBS_LIMIT_TYPE ?? 'M',
      limitValueType: process.env.CBS_LIMIT_VALUE_TYPE ?? 'A',
      limitValue: cbsAmount(HYBRID_LIMIT_GHC),
    },
  ],
});

console.log('\nContainer flow completed successfully.');
console.log(`Default request defaults used: ${JSON.stringify(CbsRequestDefaults)}`);

console.log('\nQuerying the three test subscribers...');
for (const msisdn of [PREPAID_MSISDN, POSTPAID_MSISDN, HYBRID_MSISDN]) {
  const result = await client.queryCustomerInfo(msisdn);
  console.log(`\nqueryCustomerInfo(${msisdn})`);
  console.log(JSON.stringify(result, null, 2));
}
