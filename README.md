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

The complete parsed response is available under `result.metadata`. The request does not send a `SoapAction` header and treats result code `0` as success.

The normalized code mappings are:

- `PaymentMode`: `0` prepaid, `1` postpaid, `2` hybrid
- `CurrentStatusIndex`: `1` Idle, `2` Active, `3` Call Barring, `4` Suspend, `6` Tested, `7` In stock, `8` Pre-deregistration

The `QueryCustomerInfo` request uses `POST /services/BcServices` and does not send a `SoapAction` header.

The live test disables TLS certificate validation for the internal self-signed CBS certificate. Use `rejectUnauthorized: true` in production when the certificate can be trusted normally.

To run the live test scripts, copy `.env.example` to `.env` and fill in the local credentials. The `.env` file is git-ignored.

```bash
npm run test:query-customer-info
npm run test:query-balance
```

### `createSubscriber(msisdn, options?)`

Create a new subscriber.

```typescript
const result = await client.createSubscriber('271004887', {
  lang: 1,
  paidMode: '0',
  mainProductId: '2018254719',
});
```

### `deleteSubscriber(msisdn, options?)`

Delete a subscriber.

```typescript
const result = await client.deleteSubscriber('271004887');
```

### `queryBasicInfo(msisdn, options?)`

Query basic subscriber information.

```typescript
const result = await client.queryBasicInfo('271004887');
const customer = result.QueryBasicInfoResult?.Customer;
```

## Options

### CbsClientOptions

| Property             | Type      | Required | Description                                                            |
| -------------------- | --------- | -------- | ---------------------------------------------------------------------- |
| `baseUrl`            | `string`  | Yes      | CBS server base URL (e.g., `https://10.40.14.26:8081`)                 |
| `username`           | `string`  | Yes      | Authentication username                                                |
| `password`           | `string`  | Yes      | Authentication password                                                |
| `timeout`            | `number`  | No       | Request timeout in ms (default: `15000`)                               |
| `successCode`        | `string`  | No       | Success result code (default: `405000000`)                             |
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
import type {
  QueryCustomerInfoOutput,
  NewSubscriberResponse,
  DeleteSubscriberResponse,
  QueryBasicInfoResponse,
  BalanceRecord,
  Subscriber,
  Product,
  Service,
  Customer,
} from '@enochmk/cbs-client';
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
