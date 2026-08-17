# Subscriber lifecycle operations

## Check before changing status

CBS validates lifecycle transitions. Query the subscriber first and inspect
`data.CurrentStatusIndex`:

```typescript
const lifecycle = await client.querySubLifeCycle('270118755');
console.log(lifecycle.data.CurrentStatusIndex);
```

The client exposes these lifecycle codes:

| Code | State              |
| ---: | ------------------ |
|    1 | Idle               |
|    2 | Active             |
|    3 | Call Barring       |
|    4 | Suspend            |
|    6 | Tested             |
|    7 | In Stock           |
|    8 | Pre-deregistration |

For HTC-generated resources, customer keys are `IND00000000001` or `ENT00000000001`, account keys
follow `ACC-{Customer}-{sequence}`, and subscriber keys follow `SUB-{Customer}-{sequence}`.
These keys identify CBS resources during creation. Lifecycle calls use the subscriber MSISDN as
`PrimaryIdentity`.

An Idle subscriber may not accept a direct status change. Activate it first when the CBS
deployment permits activation. Subscriber lifecycle APIs address the subscriber by MSISDN as
`PrimaryIdentity`; subscriber keys are not used as lifecycle access codes:

```typescript
await client.subActivate('270118755');
await client.changeSubscriberStatus('270118755', { status: 'SUSPEND' });
```

## Status-change SOAP contract

`changeSubscriberStatus()` maps application statuses and named operation reasons to CBS values:

| Named operation                                                                  | CBS `OpType` | CBS `NewStatus` |
| -------------------------------------------------------------------------------- | -----------: | --------------: |
| `CUSTOMER_RESUME`                                                                |           10 |               2 |
| `CUSTOMER_BARRING`                                                               |           11 |               3 |
| `CUSTOMER_SUSPENSION`                                                            |           12 |               4 |
| `ARREARS_RESUME` / `ARREARS_BARRING` / `ARREARS_SUSPENSION`                      | 30 / 31 / 32 |       2 / 3 / 4 |
| `CREDIT_CONTROL_RESUME` / `CREDIT_CONTROL_BARRING` / `CREDIT_CONTROL_SUSPENSION` | 40 / 41 / 42 |       2 / 3 / 4 |
| `OPERATOR_RESUME` / `OPERATOR_BARRING` / `OPERATOR_SUSPENSION`                   | 60 / 61 / 62 |       2 / 3 / 4 |

The request uses `<bcs:NewStatus>`, as required by the CBS R25 `ChangeSubStatusRequest` schema.

## Guarded live test

The repository includes a manual script for MSISDN `270118755`. It refuses to run unless
`--execute` is supplied:

```bash
CBS_BASE_URL=... CBS_USERNAME=... CBS_PASSWORD=... \
npm run test:change-subscriber-status -- --execute
```

Keep credentials in the environment or a secret manager. Do not commit `.env` or `.npmrc` files.
