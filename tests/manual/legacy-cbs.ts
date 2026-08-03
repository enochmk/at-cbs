import { CbsClient } from '../../src';

const baseUrl = process.env.CBS_LEGACY_BASE_URL ?? 'http://10.76.130.100:7782';
const username = process.env.CBS_USERNAME;
const password = process.env.CBS_PASSWORD;
const msisdn = process.argv[2] ?? process.env.MSISDN ?? '271004887';

if (!username || !password) {
  throw new Error('Set CBS_USERNAME and CBS_PASSWORD before running this test.');
}

const client = new CbsClient({
  baseUrl,
  username,
  password,
  logger: {
    info: (msg, ctx) => console.log('[INFO]', msg, ctx),
    warn: (msg, ctx) => console.warn('[WARN]', msg, ctx),
    error: (msg, ctx) => console.error('[ERROR]', msg, ctx),
    verbose: (msg, ctx) => console.log('[VERBOSE]', msg, ctx),
  },
});

async function main() {
  console.log('=== Testing legacy CBS operations ===');
  console.log(`MSISDN: ${msisdn}\n`);

  console.log('--- Query Basic Info ---');
  try {
    const info = await client.queryBasicInfo(msisdn);
    console.log('Result Code:', info.ResultHeader?.ResultCode);
    console.log('Customer:', info.QueryBasicInfoResult?.Customer);
  } catch (err: any) {
    console.error('Failed:', err.message);
  }

  console.log('\n--- Create Subscriber ---');
  try {
    const created = await client.createSubscriber(msisdn);
    console.log('Result Code:', created.ResultHeader?.ResultCode);
    console.log('Product Orders:', created.NewSubscriberResult?.ProductOrderInfo);
  } catch (err: any) {
    console.error('Failed:', err.message);
  }

  console.log('\n--- Delete Subscriber ---');
  try {
    const deleted = await client.deleteSubscriber(msisdn);
    console.log('Result Code:', deleted.ResultHeader?.ResultCode);
  } catch (err: any) {
    console.error('Failed:', err.message);
  }

  const productId = process.argv[3] ?? process.env.PRODUCT_ID ?? '2020847001';

  console.log('\n--- Subscribe Appendant Product ---');
  try {
    const subscribed = await client.subscribeAppendantProduct(msisdn, productId);
    console.log('Result Code:', subscribed.ResultHeader?.ResultCode);
    console.log('Product Orders:', subscribed.SubscribeAppendantProductResult?.ProductOrderInfo);
  } catch (err: any) {
    console.error('Failed:', err.message);
  }

  console.log('\n--- UnSubscribe Appendant Product ---');
  try {
    const unsubscribed = await client.unSubscribeAppendantProduct(msisdn, productId);
    console.log('Result Code:', unsubscribed.ResultHeader?.ResultCode);
  } catch (err: any) {
    console.error('Failed:', err.message);
  }

  console.log('\n=== Done ===');
}

main();
