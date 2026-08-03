import 'dotenv/config';
import { CbsClient } from '../../src';

const baseUrl = process.env.CBS_BASE_URL;
const primaryIdentity = process.argv[2] ?? process.env.MSISDN;
const cdrSeq = process.argv[3] ?? process.env.CDR_SEQ;
const username = process.env.CBS_USERNAME;
const password = process.env.CBS_PASSWORD;

if (!baseUrl || !primaryIdentity || !cdrSeq || !username || !password) {
  throw new Error(
    'Set CBS_BASE_URL, MSISDN, CDR_SEQ, CBS_USERNAME, and CBS_PASSWORD in .env, or pass MSISDN and CDR_SEQ as arguments.',
  );
}

const client = new CbsClient({
  baseUrl,
  username,
  password,
  rejectUnauthorized: false,
});

try {
  const result = await client.queryCdrDetail(primaryIdentity, cdrSeq);
  console.log('\n=== QueryCDRDetail data ===');
  console.dir(result.data, { depth: null });
} catch (error: any) {
  console.error('QueryCDRDetail failed:', error.message);
  if (error.status) console.error('HTTP status:', error.status);
  process.exitCode = 1;
}
