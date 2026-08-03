# @enochmk/cbs-client

CBS (Core Billing System) SOAP API client for AirtelTigo.

## Installation

```bash
npm install @enochmk/cbs-client
```

## Quick Start

```typescript
import { CbsClient } from '@enochmk/cbs-client';

const client = new CbsClient({
  baseUrl: 'https://10.40.14.26:8081',
  username: 'your-username',
  password: 'your-password',
});
```

## API

### `queryCustomerInfo(msisdn, options?)`

Query complete customer, subscriber, account, offering, lifecycle, and billing information.

```typescript
const result = await client.queryCustomerInfo('271004887');

// The complete parsed CBS response
const metadata = result.metadata;

// Access normalized fields
const offering = result.data.PrimaryOffering;
const firstActive = result.data.FirstActive;
const paymentMode = result.data.PaymentMode;
const status = result.data.CurrentStatusIndex;
const birthday = result.data.BirthdayDate;
const mainBalance = result.data.MainBalance;
const billCycleEndDate = result.data['bcs:BillCycleEndDate'];
```

### `queryBalance(msisdn, options?)`

Query subscriber account balances through `POST /services/ArServices`.

```typescript
const result = await client.queryBalance('261180256');
const totalAmount = result.data.TotalAmount;
const expiresAt = result.data.ExpireTime;
```

### `querySubLifeCycle(msisdn, options?)`

Query subscriber lifecycle state through `POST /services/BcServices`.

```typescript
const result = await client.querySubLifeCycle('261180256');
const status = result.data.CurrentStatusIndex;
const lifecycle = result.data.LifeCycleStatus;
```

### `queryXTransaction(msisdn, options?)`

Query the last subscriber transactions using the R25 `QueryLastXTransaction` operation. The response is returned raw because the collection does not include a response example.

```typescript
const result = await client.queryXTransaction('261180256');
console.dir(result.data, { depth: null });
```

### `queryCdrDetail(primaryIdentity, cdrSeq, options?)`

Query one CDR in detail using the R25 `QueryCDRDetail` operation. This request uses `POST /services/BbServices`, not `BcServices` or `ArServices`, and returns the CBS result body without assuming a fixed CDR schema.

```typescript
const result = await client.queryCdrDetail('261180256', '123456789');
console.dir(result.data, { depth: null });
```

`cdrSeq` is the CDR sequence identifier, not a date or MSISDN. Obtain it from your transaction/reporting flow or from a response that exposes CDR sequence values.

### Customer versus subscriber operations

`SubActivation` and `SubDeactivation` target one subscriber, normally identified by an MSISDN or `SubscriberKey`. `CustActivation` and `CustDeactivation` target the customer entity and may affect all subscribers and services belonging to that customer. Customer operations accept exactly one of `primaryIdentity`, `customerKey`, or `customerCode`.

Use the smallest scope that matches the change:

| Operation          | Target                    | Typical identifier                                           | `opType`                      |
| ------------------ | ------------------------- | ------------------------------------------------------------ | ----------------------------- |
| `SubActivation`    | One subscriber            | MSISDN or `SubscriberKey`                                    | Not used by this request      |
| `SubDeactivation`  | One subscriber            | MSISDN or `SubscriberKey`                                    | Required; deployment-specific |
| `CustActivation`   | Customer and its services | `customerKey`, `customerCode`, or customer `primaryIdentity` | Not used by this request      |
| `CustDeactivation` | Customer and its services | `customerKey`, `customerCode`, or customer `primaryIdentity` | Required; deployment-specific |

Do not use an MSISDN as a customer `primaryIdentity` unless your CBS configuration defines that MSISDN as the customer's primary identity. Prefer `customerKey` or `customerCode` when available.

### `custActivation(options)`

Activate a customer using the R25 `CustActivation` operation.

```typescript
await client.custActivation({
  customerKey: '123456',
});
```

### `subDeactivation(msisdn, options)`

Deactivate a subscriber using the R25 `SubDeactivation` operation. `opType` is required and must be a value configured in your CBS deployment; the collection does not define a universal value.

```typescript
await client.subDeactivation('261180256', {
  opType: process.env.CBS_SUB_DEACTIVATION_OP_TYPE!,
});
```

### `custDeactivation(options)`

Deactivate a customer using exactly one of `primaryIdentity`, `customerKey`, or `customerCode`, plus the deployment-specific `opType`.

```typescript
await client.custDeactivation({
  customerKey: '123456',
  opType: process.env.CBS_CUST_DEACTIVATION_OP_TYPE!,
});
```

`effectiveTime` is optional and uses the CBS timestamp format `YYYYMMDDhhmmss`:

```typescript
await client.subDeactivation('261180256', {
  opType: process.env.CBS_SUB_DEACTIVATION_OP_TYPE!,
  effectiveTime: '20260803235959',
});
```

### Recommended state-change workflow

Before changing state, query the subscriber and record the current status:

```typescript
const before = await client.querySubLifeCycle('261180256');
console.dir(before.data, { depth: null });
```

After a successful activation or deactivation, query the lifecycle again. A normal active subscriber should report `CurrentStatusIndex` `2` (`Active`). A `SubDeactivation` can move a subscriber into `Pool`. In that state, CBS may reject `ChangeSubStatus` and `SubActivation` with:

```text
The subscriber is in Pool state, and service handling is not allowed.
```

That is not an `opType` or XML formatting error. The subscriber must first be restored from Pool through the CBS provisioning or administration workflow supported by your deployment. Once it is restored to an eligible state, use the appropriate activation or lifecycle operation.

### Manual test setup

Copy the example environment file and fill in the credentials and identifiers:

```bash
cp .env.example .env
```

The manual scripts use these variables:

| Variable                                                     | Used by              | Notes                                                     |
| ------------------------------------------------------------ | -------------------- | --------------------------------------------------------- |
| `CBS_BASE_URL`                                               | All scripts          | Use the host only, for example `https://10.40.14.26:8081` |
| `CBS_USERNAME` / `CBS_PASSWORD`                              | All scripts          | CBS access credentials                                    |
| `MSISDN`                                                     | Subscriber scripts   | Can be overridden by a command-line argument              |
| `CDR_SEQ`                                                    | `QueryCDRDetail`     | Can be overridden by the second command-line argument     |
| `CBS_SUB_DEACTIVATION_OP_TYPE`                               | `SubDeactivation`    | Must be configured in CBS; there is no universal value    |
| `CBS_CUST_DEACTIVATION_OP_TYPE`                              | `CustDeactivation`   | Must be configured in CBS                                 |
| `CUSTOMER_PRIMARY_IDENTITY`, `CUSTOMER_KEY`, `CUSTOMER_CODE` | Customer scripts     | Set exactly one                                           |
| `CBS_EFFECTIVE_TIME`                                         | Deactivation scripts | Optional `YYYYMMDDhhmmss` value                           |

Run the read-only checks first:

```bash
npm run test:query-sub-life-cycle -- 261180256
npm run test:query-x-transaction -- 261180256
npm run test:query-cdr-detail -- 261180256 123456789
```

Run subscriber operations with an optional MSISDN argument:

```bash
npm run test:sub-deactivation -- 261180256
```

Run customer operations using the customer identifier from `.env`:

```bash
npm run test:cust-activation
npm run test:cust-deactivation
```

Activation and deactivation scripts change CBS state and do not have an extra confirmation prompt. Verify the identifier and operation code before running them.

The complete parsed response is available under `result.metadata`. The request does not send a `SoapAction` header and treats result code `0` as success.

The normalized code mappings are:

- `PaymentMode`: `0` prepaid, `1` postpaid, `2` hybrid
- `CurrentStatusIndex`: `1` Idle, `2` Active, `3` Call Barring, `4` Suspend, `6` Tested, `7` In stock, `8` Pre-deregistration

The `QueryCustomerInfo` request uses `POST /services/BcServices` and does not send a `SoapAction` header.

The live test scripts disable TLS certificate validation for the internal self-signed CBS certificate. Use `rejectUnauthorized: true` in production when the certificate can be trusted normally. The `.env` file is git-ignored.

## Options

### CbsClientOptions

| Property             | Type      | Required | Description                                                            |
| -------------------- | --------- | -------- | ---------------------------------------------------------------------- |
| `baseUrl`            | `string`  | Yes      | CBS server base URL (e.g., `https://10.40.14.26:8081`)                 |
| `username`           | `string`  | Yes      | Authentication username                                                |
| `password`           | `string`  | Yes      | Authentication password                                                |
| `timeout`            | `number`  | No       | Request timeout in ms (default: `15000`)                               |
| `rejectUnauthorized` | `boolean` | No       | TLS certificate validation (default: `true`)                           |
| `logger`             | `Logger`  | No       | Logger object with `info`, `warn`, `error`, `debug`, `verbose` methods |

### MSISDN Format

MSISDNs are automatically normalized to 9 digits. Accepts:

- 9 digits: `271004887`
- 10 digits: `2710048870`
- 12 digits: `233271004887`

## Types

All response types are fully typed:

```typescript
import type { QueryCustomerInfoOutput, QueryBalanceOutput } from '@enochmk/cbs-client';
```

## Error Handling

The client throws `HttpError` on failures:

```typescript
try {
  const result = await client.queryCustomerInfo('271004887');
} catch (err: any) {
  if (err.status === 400) {
    // Invalid MSISDN
  } else if (err.status === 422) {
    // CBS error (check err.message for details)
  } else if (err.status === 502) {
    // Network or SOAP error
  }
}
```

## License

MIT
