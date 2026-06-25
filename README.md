# @at/cbs

CBS (Core Billing System) SOAP API client for AirtelTigo.

## Installation

```bash
npm install @at/cbs
```

## Quick Start

```typescript
import { CbsClient } from '@at/cbs';

const client = new CbsClient({
  baseUrl: 'http://10.76.130.100:7782',
  username: 'your-username',
  password: 'your-password',
});
```

## API

### `integrationEnquiry(msisdn, options?)`

Query subscriber balance, state, products, and services.

```typescript
const result = await client.integrationEnquiry('271004887');

// Access balance records
const balances = result.IntegrationEnquiryResult?.BalanceRecordList?.BalanceRecord;

// Access subscriber state
const state = result.IntegrationEnquiryResult?.SubscriberState;

// Access products
const products = result.IntegrationEnquiryResult?.SubscriberInfo?.Product;
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

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `baseUrl` | `string` | Yes | CBS server base URL (e.g., `http://10.76.130.100:7782`) |
| `username` | `string` | Yes | Authentication username |
| `password` | `string` | Yes | Authentication password |
| `timeout` | `number` | No | Request timeout in ms (default: `15000`) |
| `successCode` | `string` | No | Success result code (default: `405000000`) |
| `logger` | `Logger` | No | Logger object with `info`, `warn`, `error`, `debug`, `verbose` methods |

### MSISDN Format

MSISDNs are automatically normalized to 9 digits. Accepts:
- 9 digits: `271004887`
- 10 digits: `2710048870`
- 12 digits: `233271004887`

## Types

All response types are fully typed:

```typescript
import type {
  IntegrationEnquiryResponse,
  NewSubscriberResponse,
  DeleteSubscriberResponse,
  QueryBasicInfoResponse,
  BalanceRecord,
  Subscriber,
  Product,
  Service,
  Customer,
} from '@at/cbs';
```

## Error Handling

The client throws `HttpError` on failures:

```typescript
try {
  const result = await client.integrationEnquiry('271004887');
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
