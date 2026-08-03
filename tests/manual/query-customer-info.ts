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
  logger: {
    info: (message, context) => console.info('[INFO]', message, context ?? ''),
    warn: (message, context) => console.warn('[WARN]', message, context ?? ''),
    error: (message, context) => console.error('[ERROR]', message, context ?? ''),
    verbose: (message, context) => console.info('[VERBOSE]', message, context ?? ''),
  },
});

try {
  const result = await client.queryCustomerInfo(msisdn);

  // console.log('\n=== QueryCustomerInfo metadata ===');
  // console.dir(result.metadata, { depth: null });

  console.log('\n=== QueryCustomerInfo data ===');
  console.dir(result.data, { depth: null });
} catch (error: any) {
  console.error('QueryCustomerInfo failed:', error.message);
  if (error.status) console.error('HTTP status:', error.status);
  process.exitCode = 1;
}
