import 'dotenv/config';
import { CbsClient } from '../../src';

const baseUrl = process.env.CBS_BASE_URL;
const username = process.env.CBS_USERNAME;
const password = process.env.CBS_PASSWORD;
const primaryIdentity = process.env.CUSTOMER_PRIMARY_IDENTITY;
const customerKey = process.env.CUSTOMER_KEY;
const customerCode = process.env.CUSTOMER_CODE;

if (!baseUrl || !username || !password) {
  throw new Error('Set CBS_BASE_URL, CBS_USERNAME, and CBS_PASSWORD in .env.');
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
  const result = await client.custActivation({
    primaryIdentity,
    customerKey,
    customerCode,
  });
  console.log('\n=== CustActivation metadata ===');
  console.dir(result.metadata, { depth: null });
} catch (error: any) {
  console.error('CustActivation failed:', error.message);
  if (error.status) console.error('HTTP status:', error.status);
  process.exitCode = 1;
}
