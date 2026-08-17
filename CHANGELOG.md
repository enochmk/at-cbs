# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.2.0] - 2026-08-17

### Added

- Added named customer-request, arrears, credit-control, and operator subscriber status operations.
- Added validation that the requested application status matches the selected CBS operation.

### Changed

- Subscriber lifecycle mutations now always address subscribers by MSISDN/`PrimaryIdentity`.
- `changeSubscriberStatus()` now supports operation codes `10`-`12`, `30`-`32`, `40`-`42`, and `60`-`62`.
- Legacy `subscriberKey` options on lifecycle mutations are retained for source compatibility but ignored.

## [2.1.2] - 2026-08-15

### Fixed

- Added the required immediate `EffectiveTime` to primary subscriber offering changes.
- Added regression and guarded manual coverage for the postpaid offering change from `2018105068` to `2018105071` on MSISDN `270118755`.

## [2.1.1] - 2026-08-15

### Fixed

- Fixed `changeSubscriberStatus()` to send the CBS R25 `NewStatus` element instead of the invalid `Status` element.
- Added regression coverage for the `SUSPEND` SOAP payload.

### Documentation

- Documented subscriber lifecycle status prerequisites and the guarded live status-change test.

## [2.1.0] - 2026-08-14

### Added

- Added `changeCustomerInfo()` for customer profile updates by customer key, customer code, or primary identity.
- Documented customer queries by both customer key and customer code.
- Documented empty individual `IDNumber` handling for customer creation and updates.
- Added customer, account, and subscriber hierarchy creation support with application-owned keys.
- Added optional R25 customer, individual, organization, address, sales, and account fields.
- Added `acctDeactivation()` for account deregistration.
- Added complete usage and cleanup documentation for customer, account, and subscriber flows.

### Changed

- Subscriber creation now supports prepaid, postpaid, and hybrid accounts in one request.
- Credit-limit scaling and individual ID-type selection remain application responsibilities.
- Removed live/manual test scripts that loaded CBS credentials from environment files.

### Deprecated

- Deprecated `createSubscriberForAccount()` in favor of the typed subscriber creation methods.
- Deprecated `poolActivation()` in favor of explicit delete, create, and activation calls.

## [2.0.6] - 2026-08-05

### Fixed

- Generated unique MSISDN/timestamp customer and account identifiers for subscriber creation.

## [2.0.5] - 2026-08-05

### Added

- Added `amountInGhc` to balance responses, converting CBS balance units by 100,000.
- Preserved original CBS-unit balance fields for reference.

## [2.0.4] - 2026-08-04

### Fixed

- Preserved readable CBS error messages containing hyphens and `<--` markers.

## [2.0.3] - 2026-08-04

### Fixed

- Prepared the CBS error propagation release for npm publication.

## [2.0.2] - 2026-08-04

### Fixed

- Propagated CBS SOAP error descriptions from non-2xx responses.
- Preserved SOAP faults and transport causes for diagnostic handling.

## [2.0.1] - 2026-08-04

### Added

- Added subscriber creation flows for prepaid, hybrid, and postpaid accounts.
- Added pool activation, subscriber activation, and subscriber status changes.
- Added number deletion with returned account amount details.

## [2.0.0] - 2026-08-04

### Breaking changes

- Replaced `integrationEnquiry()` with `queryCustomerInfo()`.
- Migrated the enquiry request to `POST /services/BcServices` using `QueryCustomerInfo`.
- Removed the SOAP action header from the new query request.
- Changed the query result to return the full response as `metadata` and normalized fields as `data`.

### Added

- Added `adjustAccount()` for CBS account balance adjustments.
- Added `subscribeAppendantProduct()` and `unsubscribeAppendantProduct()`.
- Added subscribed primary and supplementary offerings to `queryCustomerInfo()` data.

## [1.1.0] - 2026-06-26

### Added

- `subscribeAppendantProduct()` - Subscribe an appendant product to a subscriber
- `unSubscribeAppendantProduct()` - Unsubscribe an appendant product from a subscriber
- Full TypeScript types for both new API responses
- Configurable `validMode` option for subscription operations

## [1.0.0] - 2026-06-25

### Added

- Initial release
- `CbsClient` class with base URL configuration
- `integrationEnquiry()` - Query subscriber balance, state, products, services, and cumulative items
- `createSubscriber()` - Create new subscribers
- `deleteSubscriber()` - Delete subscribers
- `queryBasicInfo()` - Query basic subscriber information
- Full TypeScript types for all API responses
- MSISDN normalization (9, 10, or 12 digits)
- Configurable timeout and success codes
- Logger interface for debugging
- Automatic service URL routing (BusinessMgr vs AccountMgr)
