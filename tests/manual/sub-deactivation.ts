import 'dotenv/config';
import { CbsClient } from '../../src';

const baseUrl = process.env.CBS_BASE_URL;
const msisdn = process.argv[2] ?? process.env.MSISDN;
const username = process.env.CBS_USERNAME;
const password = process.env.CBS_PASSWORD;
const opType = process.env.CBS_SUB_DEACTIVATION_OP_TYPE || '1';

if (!baseUrl || !msisdn || !username || !password || !opType) {
  throw new Error(
    'Set CBS_BASE_URL, MSISDN, CBS_USERNAME, CBS_PASSWORD, and CBS_SUB_DEACTIVATION_OP_TYPE in .env.',
  );
}

const client = new CbsClient({
  baseUrl,
  username,
  password,
  rejectUnauthorized: false,
});

try {
  const result = await client.subDeactivation(msisdn, {
    opType,
    effectiveTime: process.env.CBS_EFFECTIVE_TIME,
  });
  console.log('\n=== SubDeactivation metadata ===');
  console.dir(result.metadata, { depth: null });
} catch (error: any) {
  console.error('SubDeactivation failed:', error.message);
  if (error.status) console.error('HTTP status:', error.status);
  process.exitCode = 1;
}
