import 'dotenv/config';
import { CbsClient } from '../../src';

if (process.env.RUN_DESTRUCTIVE_TESTS !== 'true') {
  throw new Error(
    'Refusing to run CustDeactivation. Set RUN_DESTRUCTIVE_TESTS=true when you explicitly intend to change CBS state.',
  );
}

const baseUrl = process.env.CBS_BASE_URL;
const username = process.env.CBS_USERNAME;
const password = process.env.CBS_PASSWORD;
const opType = process.env.CBS_CUST_DEACTIVATION_OP_TYPE;
const primaryIdentity = process.env.CUSTOMER_PRIMARY_IDENTITY;
const customerKey = process.env.CUSTOMER_KEY;
const customerCode = process.env.CUSTOMER_CODE;

if (!baseUrl || !username || !password || !opType) {
  throw new Error(
    'Set CBS_BASE_URL, CBS_USERNAME, CBS_PASSWORD, and CBS_CUST_DEACTIVATION_OP_TYPE in .env.',
  );
}

if ([primaryIdentity, customerKey, customerCode].filter(Boolean).length !== 1) {
  throw new Error(
    'Set exactly one of CUSTOMER_PRIMARY_IDENTITY, CUSTOMER_KEY, or CUSTOMER_CODE in .env.',
  );
}

const client = new CbsClient({
  baseUrl,
  username,
  password,
  rejectUnauthorized: false,
});

try {
  const result = await client.custDeactivation({
    opType,
    primaryIdentity,
    customerKey,
    customerCode,
    effectiveTime: process.env.CBS_EFFECTIVE_TIME,
  });
  console.log('\n=== CustDeactivation metadata ===');
  console.dir(result.metadata, { depth: null });
} catch (error: any) {
  console.error('CustDeactivation failed:', error.message);
  if (error.status) console.error('HTTP status:', error.status);
  process.exitCode = 1;
}
