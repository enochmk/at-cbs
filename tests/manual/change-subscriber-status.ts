import { CbsClient } from '../../src/cbs-client';

const msisdn = '270118755';

if (process.argv[2] !== '--execute') {
  console.error('Refusing to change CBS state without --execute.');
  console.error(
    'Usage: CBS_BASE_URL=... CBS_USERNAME=... CBS_PASSWORD=... npm run test:change-subscriber-status -- --execute',
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
    verbose: (message, context) => console.log(message, context ?? ''),
    error: (message, context) => console.error(message, context ?? ''),
  },
});

console.log(`Changing ${msisdn} to SUSPEND using the CBS ChangeSubStatus contract...`);
const result = await client.changeSubscriberStatus(msisdn, { status: 'SUSPEND' });
console.log('CBS status change succeeded:', result.data);
