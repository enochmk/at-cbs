# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - Unreleased

### Breaking changes

- Replaced `integrationEnquiry()` with `queryCustomerInfo()`.
- Migrated the enquiry request to `POST /services/BcServices` using `QueryCustomerInfo`.
- Removed the SOAP action header from the new query request.
- Changed the query result to return the full response as `metadata` and normalized fields as `data`.

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
