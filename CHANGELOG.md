# Changelog

All notable changes to this project will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

---

## [3.1.0] - 2026-03-09

### Added
- **Webhook handler**: `parseWebhookEvent()` - one-call signature verification + JSON parsing, framework-agnostic (Express, Fastify, etc.)
- **WebhookSignatureError**: dedicated error class for invalid/missing webhook signatures
- **Logger interface**: `ChargilyLogger` - pluggable logger (compatible with `console`, `winston`, `pino`)
  - Logs request debug info, retry warnings, and API errors
- **Rate limiter**: token-bucket `RateLimiter` with configurable `maxRequestsPerSecond` (default: 5, set 0 to disable)
- **README**: full rewrite with API reference, configuration guide, webhook examples, error handling docs, and comparison table vs original

### Fixed
- Downgraded ESLint to v9 for Node 18 compatibility
- Downgraded Vitest to v2 for CJS/Node 18 compatibility
- Bumped `@types/node` to `^22` to resolve peer dependency conflicts

---

## [3.0.0] - 2026-03-09

### Breaking Changes
- Package renamed from `@chargily/chargily-pay` to `@dalli/chargily-pay`
- `ChargilyClient` constructor now requires an options object with `api_key` and `mode`
- `verifySignature` now returns `false` instead of throwing on invalid signatures
- All `list*` methods now accept `PaginationParams` object instead of a plain number
- Error handling changed: throws `ChargilyApiError` / `ChargilyNetworkError` instead of generic errors

### Added
- **Retry with exponential backoff**: automatic retry on 429/5xx errors with configurable `maxRetries` and `retryDelay`
- **Request timeout**: `AbortController`-based timeout with configurable `timeout` option (default: 30s)
- **Idempotency keys**: all mutation methods (`create*`, `update*`, `delete*`, `expire*`) accept optional `RequestOptions` with `idempotencyKey`
- **Constructor validation**: throws immediately if `api_key` is empty or `mode` is invalid
- **Typed webhook events**: `WebhookEvent`, `CheckoutWebhookEvent`, `WebhookEventType`
- **Type guard functions**: `isCheckoutPaid()`, `isCheckoutFailed()`
- **Error hierarchy**: `ChargilyApiError` (with `status`, `statusText`, `body`) and `ChargilyNetworkError` (with `cause`)
- **Pagination**: `PaginationParams` with `page` and `per_page` (clamped 1-50) on all list methods
- **Dev infrastructure**: Vitest (51 tests), ESLint, Prettier, GitHub Actions CI (Node 18/20/22)

### Fixed
- **Critical**: `updateProduct`, `updatePrice`, `updatePaymentLink` used POST instead of PATCH
- **Critical**: URL validation in `createCheckout` accepted malformed URLs (e.g., `httpmalicious`)
- **Critical**: `verifySignature` threw exceptions instead of returning `false`
- **Critical**: No error typing - all API errors were generic `Error` objects
- TypeScript types: nullable fields (`description`, `failure_url`, `webhook_endpoint`, `shipping_address`)
- `CheckoutItem` and `PaymentLinkItem` return types on `getCheckoutItems` / `getPaymentLinkItems`
- Removed `sigPrefix` placeholder variable in `verifySignature`
- Removed `console.log` from `verifySignature`
- Fixed broken JSDoc comments across type definitions
- Removed unused imports (`CheckoutItemParams`, `PaymentLinkItemParams`)

---

## [2.1.0] - Original Release (upstream)

Original version by [@chargily/chargily-pay](https://github.com/chargily/chargily-pay-javascript).
