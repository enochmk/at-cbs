import 'dotenv/config';
import { CbsClient } from '../../src';

const baseUrl = process.env.CBS_BASE_URL;
const msisdn = process.argv[2] ?? process.env.MSISDN;
const username = process.env.CBS_USERNAME;
const password = process.env.CBS_PASSWORD;
const offeringId = process.env.PRODUCT_ID;
const bundledFlag = process.env.CBS_BUNDLED_FLAG;
const offeringClass = process.env.CBS_OFFERING_CLASS;
const status = process.env.CBS_STATUS;
const effectiveMode = process.env.CBS_EFFECTIVE_MODE;

if (!baseUrl || !msisdn || !username || !password || !offeringId) {
  throw new Error(
    'Set CBS_BASE_URL, MSISDN, CBS_USERNAME, CBS_PASSWORD, and CBS_OFFERING_ID in .env.',
  );
}

const client = new CbsClient({
  baseUrl,
  username,
  password,
  rejectUnauthorized: false,
});

try {
  const result = await client.subscribeAppendantProduct(msisdn, {
    offeringId,
    bundledFlag,
    offeringClass,
    status,
    effectiveMode,
  });

  console.log('\n=== SubscribeAppendantProduct data ===');
  console.dir(result.data, { depth: null });

  console.log('\n=== SubscribeAppendantProduct metadata ===');
  console.dir(result.metadata, { depth: null });
} catch (error: any) {
  console.error('SubscribeAppendantProduct failed:', error.message);
  if (error.status) console.error('HTTP status:', error.status);
  process.exitCode = 1;
}
