# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
