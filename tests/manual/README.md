# CBS manual tests

These scripts perform real CBS requests. They are not included in the automated test command.
Copy `.env.example` to `.env`, set the CBS connection values, then run one script at a time:

```bash
npx tsx tests/manual/create-and-query-hierarchy.ts
npx tsx tests/manual/query-customer-info-by-key.ts
npx tsx tests/manual/create-customer.ts
npx tsx tests/manual/create-account.ts
npx tsx tests/manual/create-subscriber-for-account.ts
npx tsx tests/manual/change-subscriber-offering.ts
npx tsx tests/manual/change-subscriber-payment-mode.ts
npx tsx tests/manual/change-account-credit-limit.ts
npx tsx tests/manual/change-payment-relation.ts
npx tsx tests/manual/adjust-security-deposit.ts
```

Creation and mutation scripts require explicit CBS identifiers and values in `.env`. The
security-deposit script uses the existing `Adjustment` operation because R25 documents no
standalone single-subscriber initial-balance operation.

`create-and-query-hierarchy.ts` is the recommended first live test. It creates a customer,
queries it, creates an account, queries it, creates a subscriber, and queries it. Use dedicated
test keys; the flow is not automatically rollbackable.
