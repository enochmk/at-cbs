import { CbsClient } from '../../src/cbs-client';

const msisdn = process.env.CBS_MSISDN ?? '270118755';
const oldOfferingId = process.env.CBS_OLD_OFFERING_ID ?? '2018105068';
const newOfferingId = process.env.CBS_NEW_OFFERING_ID ?? '2018105071';

if (process.argv[2] !== '--execute') {
  console.error('Refusing to change CBS service class without --execute.');
  console.error(
    'Usage: CBS_BASE_URL=... CBS_USERNAME=... CBS_PASSWORD=... npm run test:change-subscriber-offering -- --execute',
  );
  process.exit(1);
}

const { CBS_BASE_URL, CBS_USERNAME, CBS_PASSWORD } = process.env;
if (!CBS_BASE_URL || !CBS_USERNAME || !CBS_PASSWORD) {
  throw new Error('CBS_BASE_URL, CBS_USERNAME, and CBS_PASSWORD are required');
}

const client = new CbsClient({
  baseUrl: CBS_BASE_URL,
  username: CBS_USERNAME,
  password: CBS_PASSWORD,
  rejectUnauthorized: process.env.CBS_REJECT_UNAUTHORIZED !== 'false',
  logger: {
    verbose: (message) => console.log(message),
    error: (message) => console.error(message),
  },
});

const current = await client.queryCustomerInfo(msisdn);
const currentOffering = current.data.PrimaryOffering?.OfferingID;
const lifecycle = current.data.CurrentStatusIndex;

console.log('CBS subscriber snapshot:', {
  msisdn,
  lifecycle,
  currentOffering,
  expectedCurrentOffering: oldOfferingId,
  targetOffering: newOfferingId,
});

if (String(currentOffering) !== oldOfferingId) {
  throw new Error(
    `Refusing to change offering: CBS returned current offering ${String(currentOffering)}, expected ${oldOfferingId}`,
  );
}

const result = await client.changeSubscriberOffering({
  primaryIdentity: msisdn,
  oldOfferingId,
  newOfferingId,
});

console.log('CBS service-class change succeeded:', result.data);
