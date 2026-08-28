import {
  CbsClient,
  type QueryPaymentRelationList,
  type QueryPaymentRelationOutput,
  type QueryPaymentRelationPayRelation,
  type QueryPaymentRelationPaymentLimit,
} from '../../src';

const positionalArguments = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));
const msisdn = positionalArguments[0] ?? process.env.CBS_MSISDN;
const payAccountCode = positionalArguments[1] ?? process.env.CBS_PARENT_ACCOUNT_CODE;
const incrementGhs = process.env.CBS_ADD_LIMIT_GHS ?? '300';
const cbsLimitDivisor = process.env.CBS_LIMIT_DIVISOR ?? '100000';
const { CBS_BASE_URL, CBS_USERNAME, CBS_PASSWORD } = process.env;

if (!process.argv.includes('--execute')) {
  console.error('Refusing to change CBS state without --execute.');
  console.error(
    'Usage: CBS_BASE_URL=... CBS_USERNAME=... CBS_PASSWORD=... npm run test:change-subscriber-payment-limit -- --execute <subscriber-msisdn> <parent-account-code>',
  );
  process.exit(1);
}

if (!msisdn || !payAccountCode) {
  throw new Error('Subscriber MSISDN and parent account code are required');
}

if (!CBS_BASE_URL || !CBS_USERNAME || !CBS_PASSWORD) {
  throw new Error('CBS_BASE_URL, CBS_USERNAME, and CBS_PASSWORD are required');
}

if (!/^\d+$/.test(incrementGhs) || !/^\d+$/.test(cbsLimitDivisor) || cbsLimitDivisor === '0') {
  throw new Error('CBS_ADD_LIMIT_GHS and CBS_LIMIT_DIVISOR must be non-negative integers');
}

function one<T>(value: T | T[] | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function relationList(result: QueryPaymentRelationOutput): QueryPaymentRelationList {
  return one(result.data['bcs:PaymentRelationList']) ?? {};
}

function paymentRelation(result: QueryPaymentRelationOutput): QueryPaymentRelationPayRelation {
  const relation = one(relationList(result)['bcs:PayRelation']);
  if (!relation) throw new Error('CBS returned no payment relation');
  return relation;
}

function paymentLimit(result: QueryPaymentRelationOutput): QueryPaymentRelationPaymentLimit {
  const relation = paymentRelation(result);
  const relationKey = String(relation['bcs:PayRelationKey'] ?? '');
  const limits = relationList(result)['bcs:PaymentLimit'];
  const matchingLimit = (Array.isArray(limits) ? limits : limits ? [limits] : []).find(
    (limit) => String(limit['bcs:PaymentLimitKey'] ?? '') === relationKey,
  );
  if (!matchingLimit) throw new Error(`CBS returned no payment limit for ${relationKey}`);
  return matchingLimit;
}

function limitValue(result: QueryPaymentRelationOutput): bigint {
  const value = paymentLimit(result)['bcs:PaymentLimitInfo']?.['bcc:Limit']?.['bcc:LimitValue'];
  if (value === undefined || !/^\d+$/.test(String(value))) {
    throw new Error(`CBS returned an invalid current limit: ${String(value)}`);
  }
  return BigInt(String(value));
}

async function run(): Promise<void> {
  const client = new CbsClient({
    baseUrl: CBS_BASE_URL,
    username: CBS_USERNAME,
    password: CBS_PASSWORD,
    rejectUnauthorized: process.env.CBS_REJECT_UNAUTHORIZED !== 'false',
    logger: {
      verbose: (message, context) => console.log(message, context ?? ''),
      error: (message, context) => console.error(message, context ?? ''),
    },
  });

  const before = await client.queryPaymentRelation(msisdn, { payAccountCode });
  const currentLimit = limitValue(before);
  const increment = BigInt(incrementGhs) * BigInt(cbsLimitDivisor);
  const newLimit = currentLimit + increment;
  const payRelationKey = String(paymentRelation(before)['bcs:PayRelationKey']);

  console.log(
    JSON.stringify(
      {
        stage: 'before',
        msisdn,
        payAccountCode,
        payRelationKey,
        currentLimitCbsUnits: currentLimit.toString(),
        currentLimitGhs: Number(currentLimit) / Number(cbsLimitDivisor),
        incrementGhs,
        incrementCbsUnits: increment.toString(),
        decodedResponse: before,
      },
      null,
      2,
    ),
  );

  const update = await client.changeSubscriberPaymentLimit(msisdn, {
    payRelationKey,
    newLimit: newLimit.toString(),
  });

  console.log(JSON.stringify({ stage: 'update', decodedResponse: update }, null, 2));

  const after = await client.queryPaymentRelation(msisdn, { payAccountCode });
  const verifiedLimit = limitValue(after);
  if (verifiedLimit !== newLimit) {
    throw new Error(
      `Limit verification failed: expected ${newLimit.toString()}, got ${verifiedLimit.toString()}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        stage: 'after',
        verified: true,
        limitCbsUnits: verifiedLimit.toString(),
        limitGhs: Number(verifiedLimit) / Number(cbsLimitDivisor),
        decodedResponse: after,
      },
      null,
      2,
    ),
  );
}

await run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
