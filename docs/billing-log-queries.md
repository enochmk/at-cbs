# Billing log queries

Available in `@enochmk/cbs-client@2.12.0`. These read operations use `/services/ArServices`.
Configure `CbsClient` as shown in the [README](../README.md#configure-the-client), then supply
the subscriber's MSISDN. The client accepts 9, 10, or 12 digits and normalizes it to nine digits.

## Choose the operation

| Method                               | Records                 | Time range           | Maximum page size |
| ------------------------------------ | ----------------------- | -------------------- | ----------------- |
| `queryTransaction(msisdn, options?)` | Billing transactions    | Optional             | 1000              |
| `queryRechargeLog(msisdn, options)`  | Recharges and reversals | Both bounds required | 500               |
| `queryRefundLog(msisdn, options?)`   | Refunds                 | Optional             | 1000              |

All three methods default to `pageSize: 50`, `startRow: 0`, and `totalRows: 0`.
Recharge and refund queries require `startRow` and `totalRows` to be below 65535.
Time values are CBS strings; use the time format and timezone expected by your deployment.
The recharge request defaults to `TimeType: 2`; callers can override `timeType`.

The subscriber access code identifies the subscriber's default account. These are billing logs;
use their returned identifiers and scope when displaying records associated with shared accounts.
`queryCdrDetail(msisdn, cdrSeq)` is a separate operation requiring an existing CDR sequence.
The new methods do not list call or data-session CDRs.

## Request a page

```typescript
const transactions = await client.queryTransaction(msisdn, {
  startTime: '20261001000000',
  endTime: '20261005235959',
  pageSize: 50,
});

const recharges = await client.queryRechargeLog(msisdn, {
  startTime: '20261001000000',
  endTime: '20261005235959',
  subscriberLevelOnly: true,
  rechargeResult: 1,
  rechargeChannelIds: ['3'],
});

const refunds = await client.queryRefundLog(msisdn, {
  startTime: '20261001000000',
  endTime: '20261005235959',
});
```

`subscriberLevelOnly: true` sends `C_SUB_LOG=1` for subscriber-only recharge records.
Omitting it, or setting it to `false`, selects the default-account recharge view. Other recharge
filters are `extTransId`, `rechargeType` (a site-configured external type), `innerRechargeType`
(`'0'` voucher, `'1'` cash, `'2'` EVC, `'3'` cash reversal), and `rechargeResult`
(`0` failed, `1` successful). `rechargeType` and `innerRechargeType` cannot be combined.
When `rechargeResult` is omitted, CBS configuration determines which outcomes are returned.

## Read the response and paginate

Each response contains the complete parsed `metadata` and `data`, plus an array named
`transactions`, `recharges`, or `refunds`. Arrays remain arrays when CBS returns one record.
Fields retain their XML prefixes, such as `record['ars:TransID']` or
`record['ars:RechargeAmount']`. Nested bank, channel, bonus, and lifecycle information is preserved.
Amounts and identifiers remain strings, preserving precision. Interpret amounts using the CBS
currency and scale configured for your tenant; do not assume they are already Ghana cedis.

The normalized `pagination` contains `totalRows` when CBS returns a valid total, the requested
`startRow` and `pageSize`, and the actual `rowsReturned`. A missing total is not a confirmed zero.
To fetch the next page, pass the previous total and advance by the actual returned row count.
Keep the same subscriber and filters throughout the paging sequence.

```typescript
let startRow = 0;
let totalRows = 0;
const pageSize = 50;

for (;;) {
  const page = await client.queryRefundLog(msisdn, { startRow, totalRows, pageSize });
  // Consume page.refunds here; avoid logging complete subscriber records.
  totalRows = page.pagination.totalRows ?? totalRows;
  const nextRow = startRow + page.pagination.rowsReturned;
  const reachedEnd = page.pagination.totalRows !== undefined && nextRow >= totalRows;
  const shortPageWithoutTotal =
    page.pagination.totalRows === undefined && page.pagination.rowsReturned < pageSize;
  if (page.pagination.rowsReturned === 0 || reachedEnd || shortPageWithoutTotal) break;
  startRow = nextRow;
}
```

Recharge summaries remain in `data['ars:RechargeSumList']` when CBS supplies them. They are
conditional on CBS configuration and query scope; missing summaries must not be displayed as zero.

## Handle failures

Invalid paging or conflicting recharge filters produce HTTP-style errors with `status: 400`.
CBS business failures produce `status: 422`, retaining `resultCode`, `operation`, and the CBS
description. Transport failures, timeouts, and SOAP faults produce `status: 502`.
An application should show a retryable error for an unavailable query rather than displaying an
empty successful result. Automatic retry policy belongs to the caller; these methods do not
automatically traverse pages or retry failed requests.

The release has local SOAP request/response regression coverage. Live CBS queries remain
unverified after the earlier transaction lookup timed out. Payment, account-transfer, and
adjustment log queries are still pending; `adjustBalances()` is a mutation, not a log query.

## Manual references

CBS R25 WebService Interface Reference, printed pages: `QueryTransaction` 1141–1148,
`QueryRefundLog` 1149–1156, and `QueryRechargeLog` 1157–1174 (including the response ending
on page 1174). The recharge sample uses `BusinessCode: 1`.
