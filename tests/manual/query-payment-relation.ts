import { CbsClient } from '../../src';

const msisdn = process.argv[2] ?? process.env.CBS_MSISDN;
const payAccountCode = process.argv[3] ?? process.env.CBS_PARENT_ACCOUNT_CODE;
const { CBS_BASE_URL, CBS_USERNAME, CBS_PASSWORD } = process.env;

if (!msisdn || !payAccountCode) {
  console.error(
    'Usage: CBS_BASE_URL=... CBS_USERNAME=... CBS_PASSWORD=... npm run test:query-payment-relation -- <subscriber-msisdn> <parent-account-code>',
  );
  process.exit(1);
}

if (!CBS_BASE_URL || !CBS_USERNAME || !CBS_PASSWORD) {
  throw new Error('CBS_BASE_URL, CBS_USERNAME, and CBS_PASSWORD are required');
}

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

const result = await client.queryPaymentRelation(msisdn, { payAccountCode });

console.log(
  JSON.stringify(
    {
      request: { msisdn, payAccountCode },
      decodedResponse: result,
    },
    null,
    2,
  ),
);
