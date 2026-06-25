# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
