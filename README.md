# @enochmk/cbs-client

TypeScript SOAP client for AirtelTigo Huawei CBS R25 customer, account, subscriber, balance,
offering, lifecycle, and transaction operations.

## Install

```bash
npm install @enochmk/cbs-client
```

The package publishes only the compiled `dist` directory. The repository contains unit tests, a
Postman collection, and a guarded live-CBS status-change test script.

## Configure the client

Keep CBS credentials in your application's secret manager or environment. Never put credentials
in source code, tests, Postman exports, or committed `.env` files.

```typescript
import { CbsClient } from '@enochmk/cbs-client';

const client = new CbsClient({
  baseUrl: process.env.CBS_BASE_URL!,
  username: process.env.CBS_USERNAME!,
  password: process.env.CBS_PASSWORD!,
  rejectUnauthorized: process.env.CBS_REJECT_UNAUTHORIZED === 'true',
  timeout: 30_000,
});
```

`rejectUnauthorized` defaults to `false` for deployments using an internal CBS certificate. Set it
to `true` when the CBS certificate chain is trusted. The `.env.example` file contains placeholders
only.

## Shared request options

Every request accepts optional CBS request-header overrides:

```typescript
await client.queryCustomerInfo('270118755', {
  messageSeq: 'htc-query-001',
  version: 1,
  beId: '101',
  operatorId: '101',
  accessMode: 3,
  msgLanguageCode: 2002,
  timeType: 1,
  remoteAddress: '10.0.0.10',
  remark: 'Customer support lookup',
});
```

Use `CbsRequestDefaults`, `PaymentModeCode`, and `SubscriberStatusCode` instead of repeating
stable numeric constants. MSISDNs accept 9, 10, or 12 digits and are normalized to the CBS
9-digit primary identity format.

The HTC application owns the identifier format sent to CBS: individual customers use
`IND00000000001`, enterprise customers use `ENT00000000001`, accounts use
`ACC-{Customer}-1`, and subscribers use `SUB-{Customer}-1`. These application keys are resource
identifiers; subscriber lifecycle requests still use the MSISDN as `PrimaryIdentity`.

## Customer operations

### Create a customer

`createCustomer` supports individual and organization information, customer basic information,
properties, addresses, sales information, default accounts, and effective time. CAF files and HTC
workflow metadata remain application-owned and are not sent to CBS.

```typescript
await client.createCustomer({
  registerCustKey: 'CUST-REG-20260814',
  customerKey: 'CUST-20260814185641998',
  customerCode: 'CUST-20260814185641998',
  customerType: 1,
  customerNodeType: 1,
  customerClass: 1,
  individual: {
    idType: '1', // The application chooses the ID type.
    idNumber: 'GHA-123456789-0',
    title: 'MR',
    firstName: 'Kwame',
    middleName: 'Kofi',
    lastName: 'Mensah',
    gender: 'M',
    nationality: 'GHA',
    birthday: '19900101',
    mobilePhone: '270118755',
    email: 'kwame@example.com',
    properties: [{ code: 'KYC_SOURCE', value: 'SHARED_KYC' }],
  },
  addressInfo: {
    addressKey: 'ADDR-202608141',
    address1: '1 Independence Avenue',
    address2: 'Accra',
    postCode: 'GA-000-0000',
  },
  customerBasicInfo: {
    defaultWrittenLanguage: 2002,
    properties: [{ code: 'CUSTOMER_SEGMENT', value: 'B2B' }],
  },
  salesInfo: { salesId: 'SALES-001', salesChannelId: 'HTC' },
});
```

For an enterprise customer, replace `individual` with `organization`:

```typescript
await client.createCustomer({
  registerCustKey: 'CUST-REG-ENTERPRISE-001',
  customerKey: 'CUST-ENTERPRISE-001',
  customerType: 1,
  organization: {
    idType: '1',
    idNumber: 'BR-123456',
    organizationType: 1,
    name: 'Example Ghana Limited',
    shortName: 'Example GH',
    industry: 'Telecommunications',
    phoneNumber: '0302000000',
    email: 'billing@example.com',
    website: 'https://example.com',
  },
});
```

The application decides the customer type and organization or individual `idType`; the client
passes those values through unchanged.

For a live tenant smoke test, use the guarded manual script. It generates a unique organization
and sends the minimal payload that was verified against CBS R25:

```bash
npm run test:create-enterprise-customer -- --execute
```

The script uses `customerType: 2`, `industry: 'Telcom'`, and omits `organizationType` and custom
properties such as TIN. Those values are tenant-specific or HTC-local and should not be sent to
CBS unless the target tenant explicitly supports them.

### Query a customer hierarchy

Query by MSISDN or by exactly one CBS key. The parsed result includes customer, subscriber,
account, offering, lifecycle, billing-cycle, and main-balance fields when CBS returns them.

```typescript
const byMsisdn = await client.queryCustomerInfo('270118755');
const byCustomer = await client.queryCustomerInfoByKey({
  customerCode: 'CUST-20260814185641998',
});
const byAccount = await client.queryCustomerInfoByKey({
  accountCode: 'ACCT-20260814185641998-1',
});
const bySubscriber = await client.queryCustomerInfoByKey({
  subscriberKey: 'SUB-20260814185641998-1-1',
});

console.log(byMsisdn.data.PaymentMode);
console.log(byMsisdn.data.CurrentStatusIndex);
console.log(byMsisdn.data.PrimaryOffering);
console.log(byMsisdn.data.MainBalance?.amountInGhc);
```

### Update customer information

`changeCustomerInfo` requires exactly one of `customerKey`, `customerCode`, or
`primaryIdentity`.

```typescript
await client.changeCustomerInfo({
  customerKey: 'CUST-20260814185641998',
  individual: {
    lastName: 'Mensah-Updated',
    idNumber: '',
    email: 'updated@example.com',
  },
  additionalProperties: [{ code: 'CRM_STATUS', value: 'VERIFIED' }],
});
```

### Activate or deregister a customer

```typescript
await client.custActivation({ customerKey: 'CUST-20260814185641998' });

await client.custDeactivation({
  customerKey: 'CUST-20260814185641998',
  opType: '2', // Normal deregistration in the R25 reference.
});
```

Customer deregistration requires no valid subscriber or account references. For cleanup, delete
subscribers first, then accounts, then the customer.

## Account operations

### Create a standalone account

Use `createAccount` when an account must be provisioned independently. When creating a subscriber
and its account together, prefer the typed subscriber creation methods below.

```typescript
await client.createAccount({
  registerCustKey: 'CUST-20260814185641998',
  accountKey: 'ACCT-20260814185641998-1',
  accountCode: 'ACCT-20260814185641998-1',
  userCustomerKey: 'CUST-20260814185641998',
  paymentType: 1,
  creditLimitType: 'C_INITIAL_CREDIT_LIMIT',
  // The application supplies CBS units: GHS 10 = 1,000,000.
  creditLimit: 1_000_000,
});
```

Credit limits are passed unchanged. The client does not multiply or divide the value.

### Update an account credit limit

```typescript
await client.changeAccountCreditLimit({
  accountCode: 'ACCT-20260814185641998-1',
  creditLimitType: 'C_INITIAL_CREDIT_LIMIT',
  newLimitAmount: 2_000_000,
});
```

### Add or remove payment relations

Identify the account, subscriber, customer, or primary identity with exactly one supported access
key. Supply either `addPayRelation` or `deletePayRelationKey` as required by the operation.

```typescript
await client.changePaymentRelation({
  accountKey: 'ACCT-20260814185641998-1',
  addPayRelation: {
    payRelationKey: 'PAY-20260814185641998-5',
    accountKey: 'ACCT-20260814185641998-1',
    priority: 50,
  },
});

await client.changePaymentRelation({
  accountKey: 'ACCT-20260814185641998-1',
  deletePayRelationKey: 'PAY-20260814185641998-5',
});
```

### Deregister an account

```typescript
await client.acctDeactivation({
  accountCode: 'ACCT-20260814185641998-1',
  opType: '2', // Deregister in the R25 reference.
});
```

An account cannot be deregistered while it is a default account or has valid payment relations.
Remove the subscriber/payment relationships first.

## Subscriber operations

### Create prepaid, postpaid, or hybrid subscribers

The application owns every key. `customerKey` must equal the parent customer key. Each account's
`accountKey` and `accountCode` must match and be unique; payment relation keys must also be unique.
The client does not generate identifiers, choose identity types, or transform credit limits.

```typescript
const common = {
  customerKey: 'CUST-20260814185641998',
  subscriberKey: 'SUB-20260814185641998-1-1',
  offeringId: '2018105068',
  status: 1,
};

await client.createPostpaidSubscriber('270118755', {
  ...common,
  accounts: [
    {
      accountKey: 'ACCT-20260814185641998-1',
      accountCode: 'ACCT-20260814185641998-1',
      paymentRelationKey: 'PAY-20260814185641998-1',
      paymentType: 1,
      creditLimit: 1_000_000,
    },
  ],
});

await client.createPrepaidSubscriber('270105755', {
  customerKey: 'CUST-20260814185641998',
  subscriberKey: 'SUB-20260814185641998-2-1',
  offeringId: '2018246521',
  status: 1,
  // Omit accounts to create the subscriber without an account.
});

await client.createHybridSubscriber('261180254', {
  customerKey: 'CUST-20260814185641998',
  subscriberKey: 'SUB-20260814185641998-3-1',
  offeringId: '2018105022',
  status: 1,
  accounts: [
    {
      accountKey: 'ACCT-20260814185641998-3',
      accountCode: 'ACCT-20260814185641998-3',
      paymentRelationKey: 'PAY-20260814185641998-3',
      paymentType: 1,
      defaultAccount: true,
      priority: 50,
      creditLimit: 1_000_000,
    },
    {
      accountKey: 'ACCT-20260814185641998-4',
      accountCode: 'ACCT-20260814185641998-4',
      paymentRelationKey: 'PAY-20260814185641998-4',
      paymentType: 0,
      defaultAccount: false,
      priority: 51,
    },
  ],
});
```

Rules enforced by the client:

- Prepaid accounts use `paymentType: 0`; postpaid accounts use `paymentType: 1`.
- Prepaid and postpaid creation accepts zero accounts or exactly one account.
- Hybrid creation requires exactly two accounts: one prepaid and one postpaid.
- Hybrid creation requires exactly one default account.
- The primary offering status is set to the supplied subscriber/account status value.
- The client sends the supplied credit-limit value unchanged.

### Update subscriber offering and payment mode

```typescript
await client.changeSubscriberOffering({
  primaryIdentity: '270118755',
  oldOfferingId: '2018105068',
  newOfferingId: '2018105071',
});

await client.changeSubscriberPaymentMode({
  primaryIdentity: '270118755',
  paymentMode: 1,
  oldOfferingId: '2018105068',
  newOfferingId: '2018105071',
  accountKey: 'ACCT-20260814185641998-1',
  paymentRelationKey: 'PAY-20260814185641998-1',
});
```

`changeSubscriberOffering()` sends an immediate `EffectiveTime` mode when one is not supplied.
CBS R25 requires the element-only form inside `PrimaryOffering`:
`<bcs:EffectiveTime><bcc:Mode>I</bcc:Mode></bcs:EffectiveTime>`.

### Subscriber lifecycle and status

Query the current lifecycle before attempting a status change. CBS may reject transitions from
states such as `Idle` when the subscriber is not serviceable. The status-change request sends the
R25 `NewStatus` element required by the CBS `ChangeSubStatusRequest` schema.

```typescript
const lifecycle = await client.querySubLifeCycle('270118755');
console.log(lifecycle.data.CurrentStatusIndex);

await client.subActivate('270118755');
await client.changeSubscriberStatus('270118755', { status: 'SUSPEND' });
await client.changeSubscriberStatus('270118755', { status: 'CALL_BARRING' });
await client.changeSubscriberStatus('270118755', {
  status: 'ACTIVE',
  operation: 'CUSTOMER_RESUME',
});

await client.subDeactivation('270118755', {
  opType: '1', // Deployment-specific: use the value configured by CBS.
});
```

Lifecycle status codes exposed by `SubscriberStatusCode` are `1` Idle, `2` Active, `3` Call
Barring, `4` Suspend, `6` Tested, `7` In Stock, and `8` Pre-deregistration.

Subscriber lifecycle requests use the MSISDN as the CBS `PrimaryIdentity`. `subscriberKey` is a
resource key used during subscriber creation and is ignored by lifecycle mutation methods. Customer
queries use `CustomerKey`; account queries use `AccountKey` or `AccountCode`.

`changeSubscriberStatus()` defaults to customer-request operations, and supports the following
named operation variants:

| Operation                                                                        | CBS `OpType` | Target status |
| -------------------------------------------------------------------------------- | -----------: | ------------: |
| `CUSTOMER_RESUME` / `CUSTOMER_BARRING` / `CUSTOMER_SUSPENSION`                   | 10 / 11 / 12 |     2 / 3 / 4 |
| `ARREARS_RESUME` / `ARREARS_BARRING` / `ARREARS_SUSPENSION`                      | 30 / 31 / 32 |     2 / 3 / 4 |
| `CREDIT_CONTROL_RESUME` / `CREDIT_CONTROL_BARRING` / `CREDIT_CONTROL_SUSPENSION` | 40 / 41 / 42 |     2 / 3 / 4 |
| `OPERATOR_RESUME` / `OPERATOR_BARRING` / `OPERATOR_SUSPENSION`                   | 60 / 61 / 62 |     2 / 3 / 4 |

For a guarded live test against MSISDN `270118755`, provide credentials through environment
variables and explicitly pass `--execute`:

```bash
CBS_BASE_URL=https://cbs.example.invalid/services/BcServices \
CBS_USERNAME=... \
CBS_PASSWORD=... \
npm run test:change-subscriber-status -- --execute
```

The script changes the subscriber to `SUSPEND`; it does not automatically activate an Idle
subscriber. Check the lifecycle result first and activate it using `subActivate()` when required.

For permanent number deletion, use `deleteNumber`. It sends `SubDeactivation` with R25
`opType=3`:

```typescript
await client.deleteNumber('270118755', {
  // Subscriber deletion uses the MSISDN/PrimaryIdentity above.
});
```

This is destructive. Verify the identifier and query the subscriber after the request.

### Subscribe or remove an appendant offering

```typescript
const added = await client.subscribeAppendantProduct('270118755', {
  offeringId: '2019000001',
  bundledFlag: 'N',
  offeringClass: 'I',
  status: 1,
});

await client.unsubscribeAppendantProduct('270118755', {
  offeringId: '2019000001',
  purchaseSeq: added.data.PurchaseSeq!,
});
```

### Deprecated subscriber helpers

`createSubscriberForAccount` and `poolActivation` remain available for source compatibility but
are deprecated. Use the typed subscriber creation methods and explicit lifecycle calls instead:

```typescript
await client.deleteNumber(msisdn);
await client.createPrepaidSubscriber(msisdn, createOptions);
await client.subActivate(msisdn);
```

## Balance and transaction operations

```typescript
const balance = await client.queryBalance('270118755');
console.log(balance.data.TotalAmount, balance.data.amountInGhc);

await client.adjustAccount('270118755', {
  adjustmentAmt: 100_000,
  balanceType: 'C_MAIN_ACCOUNT',
  adjustmentType: 2,
  currencyId: 1054,
  adjustmentReasonCode: 'DNTREQ',
  opType: 2,
  adjustmentSerialNo: 'ADJ-20260814-001',
});

const transactions = await client.queryXTransaction('270118755');
console.dir(transactions.data, { depth: null });

const cdr = await client.queryCdrDetail('270118755', '123456789');
console.dir(cdr.data, { depth: null });
```

`queryCdrDetail` uses `BbServices`; the other subscriber/account operations use `BcServices`, and
balance operations use `ArServices`.

## Cleanup order

Use bottom-up cleanup so CBS does not reject a parent with active children:

```typescript
for (const msisdn of subscriberMsisdns) {
  await client.deleteNumber(msisdn);
}

for (const accountCode of accountCodes) {
  await client.acctDeactivation({ accountCode, opType: '2' });
}

await client.custDeactivation({ customerKey, opType: '2' });
```

Query each subscriber by MSISDN, each account by account code, and the customer by customer key or
code to confirm that CBS no longer returns the records.

## Testing and release checks

Tests are local HTTP-backed unit tests; they do not load credentials or connect to CBS:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

`npm run build` is also the `prepublishOnly` hook. Review the tarball file list from
`npm pack --dry-run` before publishing.

## Postman collection

`postman/cbs-client.collection.json` contains executable R25 SOAP examples. Set the collection
variables locally before use; the committed collection contains placeholders and no credentials.

## License

MIT
