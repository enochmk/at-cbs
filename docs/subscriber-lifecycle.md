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

An Idle subscriber may not accept a direct status change. Activate it first when the CBS
deployment permits activation:

```typescript
await client.subActivate('270118755');
await client.changeSubscriberStatus('270118755', { status: 'SUSPEND' });
```

## Status-change SOAP contract

`changeSubscriberStatus()` maps application statuses to CBS operation values:

| Client status  | CBS operation | CBS `NewStatus` |
| -------------- | ------------: | --------------: |
| `ACTIVE`       |            10 |               2 |
| `CALL_BARRING` |            11 |               3 |
| `SUSPEND`      |            12 |               4 |

The request uses `<bcs:NewStatus>`, as required by the CBS R25 `ChangeSubStatusRequest` schema.

## Guarded live test

The repository includes a manual script for MSISDN `270118755`. It refuses to run unless
`--execute` is supplied:

```bash
CBS_BASE_URL=... CBS_USERNAME=... CBS_PASSWORD=... \
npm run test:change-subscriber-status -- --execute
```

Keep credentials in the environment or a secret manager. Do not commit `.env` or `.npmrc` files.
