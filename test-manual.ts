import { CbsClient } from './src';

const client = new CbsClient({
  baseUrl: 'http://10.76.130.100:7782',
  username: 'dwdev',
  password: 'C591D9B26FE9B27F5F01246252578E5FA8E6C4E26356DC7AF3CBDDD998E1D3EA',
  logger: {
    info: (msg, ctx) => console.log('[INFO]', msg, ctx),
    warn: (msg, ctx) => console.warn('[WARN]', msg, ctx),
    error: (msg, ctx) => console.error('[ERROR]', msg, ctx),
    verbose: (msg, ctx) => console.log('[VERBOSE]', msg, ctx),
  },
});

const MSISDN = process.argv[2] || '271004887';

async function main() {
  console.log('=== Testing CBS Client ===');
  console.log(`MSISDN: ${MSISDN}\n`);

  console.log('--- Integration Enquiry ---');
  try {
    const enquiry = await client.integrationEnquiry(MSISDN);
    console.log('Result Code:', enquiry.ResultHeader?.ResultCode);
    console.log('Balance:', enquiry.IntegrationEnquiryResult?.BalanceRecordList?.BalanceRecord);
    console.log('Subscriber State:', enquiry.IntegrationEnquiryResult?.SubscriberState);
    console.log('Customer:', enquiry.IntegrationEnquiryResult?.Customer);
  } catch (err: any) {
    console.error('Failed:', err.message);
  }

  console.log('\n--- Query Basic Info ---');
  try {
    const info = await client.queryBasicInfo(MSISDN);
    console.log('Result Code:', info.ResultHeader?.ResultCode);
    console.log('Customer:', info.QueryBasicInfoResult?.Customer);
  } catch (err: any) {
    console.error('Failed:', err.message);
  }

  console.log('\n--- Create Subscriber ---');
  try {
    const created = await client.createSubscriber(MSISDN);
    console.log('Result Code:', created.ResultHeader?.ResultCode);
    console.log('Product Orders:', created.NewSubscriberResult?.ProductOrderInfo);
  } catch (err: any) {
    console.error('Failed:', err.message);
  }

  console.log('\n--- Delete Subscriber ---');
  try {
    const deleted = await client.deleteSubscriber(MSISDN);
    console.log('Result Code:', deleted.ResultHeader?.ResultCode);
  } catch (err: any) {
    console.error('Failed:', err.message);
  }

  console.log('\n=== Done ===');
}

main();
