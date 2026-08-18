import { randomUUID } from 'node:crypto';

import { CbsClient, type CreateCustomerOptions } from '../../src/cbs-client';

const requiredEnvironment = ['CBS_BASE_URL', 'CBS_USERNAME', 'CBS_PASSWORD'] as const;
const missingEnvironment = requiredEnvironment.filter((key) => !process.env[key]);

if (process.argv[2] !== '--execute') {
  console.error('Refusing to create a CBS customer without --execute.');
  console.error('Usage: npm run test:create-enterprise-customer -- --execute');
  process.exit(1);
}

if (missingEnvironment.length > 0) {
  throw new Error(
    `${missingEnvironment.join(', ')} ${missingEnvironment.length === 1 ? 'is' : 'are'} required`,
  );
}

const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
const timestamp = Date.now().toString().slice(-10);
const customerKey = `ENTMAN${timestamp}${suffix}`;
const businessNumber = `BR${timestamp}${suffix.slice(0, 4)}`;
const companyName = `CBS Manual ${suffix}`;

const payload: CreateCustomerOptions = {
  registerCustKey: customerKey,
  customerKey,
  customerCode: customerKey,
  customerType: 2,
  organization: {
    idType: '1',
    idNumber: businessNumber,
    name: companyName,
    shortName: `CBS${suffix.slice(0, 6)}`,
    industry: 'Telcom',
    email: `cbs-${suffix.toLowerCase()}@example.com`,
  },
};

const client = new CbsClient({
  baseUrl: process.env.CBS_BASE_URL!,
  username: process.env.CBS_USERNAME!,
  password: process.env.CBS_PASSWORD!,
  rejectUnauthorized: process.env.CBS_REJECT_UNAUTHORIZED !== 'false',
  logger: {
    verbose: (message, context) => console.log(message, context ?? ''),
    error: (message, context) => console.error(message, context ?? ''),
  },
});

console.log('Creating randomized CBS enterprise customer with this organization payload:');
console.log(JSON.stringify(payload, null, 2));
console.log(
  'HTC-only fields intentionally omitted from CBS: TIN, CAF/workflow metadata, and HTC addresses.',
);

try {
  const result = await client.createCustomer(payload);
  console.log('CBS enterprise customer creation succeeded:');
  console.log(JSON.stringify({ customerKey, businessNumber, result: result.data }, null, 2));
} catch (error) {
  const details = error instanceof Error ? { name: error.name, message: error.message } : error;
  console.error('CBS enterprise customer creation failed:');
  console.error(JSON.stringify(details, null, 2));
  process.exitCode = 1;
}
