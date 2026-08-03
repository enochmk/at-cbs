import { CbsClient } from '../../src';

const msisdn = process.argv[2] ?? process.env.MSISDN;
const baseUrl = process.env.CBS_BASE_URL ?? 'https://10.40.14.26:8081';
const username = process.env.CBS_USERNAME ?? '102';
const password = process.env.CBS_PASSWORD;

if (!msisdn) {
  throw new Error('Provide an MSISDN as the first argument or set MSISDN.');
}

if (!password) {
  throw new Error('Set CBS_PASSWORD before running this test.');
}

const client = new CbsClient({
  baseUrl,
  username,
  password,
  rejectUnauthorized: false,
});

try {
  const result = await client.queryBalance(msisdn);
  console.log('\n=== QueryBalance data ===');
  console.dir(result.data, { depth: null });
} catch (error: any) {
  console.error('QueryBalance failed:', error.message);
  if (error.status) console.error('HTTP status:', error.status);
  process.exitCode = 1;
}
