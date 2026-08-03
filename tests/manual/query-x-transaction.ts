import 'dotenv/config';
import { CbsClient } from '../../src';

const baseUrl = process.env.CBS_BASE_URL;
const msisdn = process.argv[2] ?? process.env.MSISDN;
const username = process.env.CBS_USERNAME;
const password = process.env.CBS_PASSWORD;

if (!baseUrl || !msisdn || !username || !password) {
  throw new Error('Set CBS_BASE_URL, MSISDN, CBS_USERNAME, and CBS_PASSWORD in .env.');
}

const client = new CbsClient({
  baseUrl,
  username,
  password,
  rejectUnauthorized: false,
});

try {
  const result = await client.queryXTransaction(msisdn);
  console.log('\n=== QueryLastXTransaction data ===');
  console.dir(result.data, { depth: null });
} catch (error: any) {
  console.error('QueryLastXTransaction failed:', error.message);
  if (error.status) console.error('HTTP status:', error.status);
  process.exitCode = 1;
}
