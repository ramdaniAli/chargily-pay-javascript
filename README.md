# @dalli/chargily-pay

A robust, production-ready JavaScript/TypeScript SDK for the [Chargily Pay](https://chargily.com/business/pay)™ Gateway V2.

Integrate EDAHABIA (Algerie Poste) and CIB (SATIM) payments into your Node.js applications.

> **Fork of [@chargily/chargily-pay](https://github.com/chargily/chargily-pay-javascript)** with critical bug fixes, resilience features, and developer experience improvements.

## Features

- Full TypeScript support with strict types
- Retry with exponential backoff on 429/5xx errors
- Configurable request timeout with AbortController
- Built-in rate limiter (token bucket)
- Idempotency key support for safe retries
- Typed webhook events with signature verification
- Framework-agnostic webhook handler (`parseWebhookEvent`)
- Optional logger interface (compatible with console, winston, pino)
- Pagination support with validation
- Proper error hierarchy (`ChargilyApiError`, `ChargilyNetworkError`)

## Installation

```bash
npm install @dalli/chargily-pay
```

**Requires Node.js >= 18** (uses native `fetch`).

## Quick Start

```ts
import { ChargilyClient } from '@dalli/chargily-pay';

const client = new ChargilyClient({
  api_key: 'YOUR_API_SECRET_KEY',
  mode: 'test', // 'test' or 'live'
});

// Create a checkout
const checkout = await client.createCheckout({
  amount: 5000,
  currency: 'dzd',
  success_url: 'https://example.com/success',
});

console.log(checkout.checkout_url); // Redirect your customer here
```

## Configuration

```ts
const client = new ChargilyClient({
  api_key: 'YOUR_API_SECRET_KEY',
  mode: 'test',

  // Resilience
  timeout: 30000,            // Request timeout in ms (default: 30000)
  maxRetries: 2,             // Retries on 429/5xx (default: 2)
  retryDelay: 1000,          // Base delay for exponential backoff (default: 1000)

  // Rate limiting
  maxRequestsPerSecond: 5,   // Token bucket rate limit (default: 5, 0 to disable)

  // Logging
  logger: console,           // Any object with debug/info/warn/error methods
});
```

## API Reference

### Customers

```ts
const customer = await client.createCustomer({ name: 'Ali', email: 'ali@example.com' });
const fetched  = await client.getCustomer('customer_id');
const updated  = await client.updateCustomer('customer_id', { name: 'Ali R.' });
const deleted  = await client.deleteCustomer('customer_id');
const list     = await client.listCustomers({ per_page: 20, page: 1 });
```

### Products

```ts
const product = await client.createProduct({ name: 'T-Shirt' });
const fetched = await client.getProduct('product_id');
const updated = await client.updateProduct('product_id', { name: 'Premium T-Shirt' });
const deleted = await client.deleteProduct('product_id');
const list    = await client.listProducts({ per_page: 10 });
```

### Prices

```ts
const price  = await client.createPrice({ amount: 2500, currency: 'dzd', product_id: 'product_id' });
const fetched = await client.getPrice('price_id');
const updated = await client.updatePrice('price_id', { metadata: { size: 'L' } });
const list    = await client.listPrices({ per_page: 10 });
const prices  = await client.getProductPrices('product_id');
```

### Checkouts

```ts
// With items
const checkout = await client.createCheckout({
  items: [{ price: 'price_id', quantity: 2 }],
  success_url: 'https://example.com/success',
  failure_url: 'https://example.com/failure',
  webhook_endpoint: 'https://example.com/webhook',
  locale: 'fr',
});

// With direct amount
const checkout2 = await client.createCheckout({
  amount: 5000,
  currency: 'dzd',
  success_url: 'https://example.com/success',
});

const details = await client.getCheckout('checkout_id');
const items   = await client.getCheckoutItems('checkout_id');
const expired = await client.expireCheckout('checkout_id');
const list    = await client.listCheckouts({ per_page: 10 });
```

### Payment Links

```ts
const link    = await client.createPaymentLink({
  name: 'Summer Sale',
  items: [{ price: 'price_id', quantity: 1, adjustable_quantity: true }],
});
const fetched = await client.getPaymentLink('link_id');
const updated = await client.updatePaymentLink('link_id', { name: 'Winter Sale' });
const items   = await client.getPaymentLinkItems('link_id');
const list    = await client.listPaymentLinks();
```

### Balance

```ts
const balance = await client.getBalance();
console.log(balance.wallets); // [{ currency: 'dzd', balance: 50000, ... }]
```

### Idempotency

All mutation methods accept an optional `RequestOptions` parameter to prevent duplicate operations:

```ts
const customer = await client.createCustomer(
  { name: 'Ali' },
  { idempotencyKey: 'unique-request-id-123' }
);
```

## Webhooks

### Quick Setup (Recommended)

Use `parseWebhookEvent` for one-call verify + parse:

```ts
import express from 'express';
import { parseWebhookEvent, isCheckoutPaid } from '@dalli/chargily-pay';

const app = express();
const SECRET = 'YOUR_API_SECRET_KEY';

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = parseWebhookEvent(req.body, req.headers['signature'] as string, SECRET);

    if (isCheckoutPaid(event)) {
      console.log('Payment received!', event.data.id);
      // Handle successful payment
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(400);
  }
});

app.listen(4000);
```

### Manual Verification

For more control, use `verifySignature` directly:

```ts
import { verifySignature } from '@dalli/chargily-pay';

const isValid = verifySignature(rawBodyBuffer, signatureHeader, secretKey);
```

### Webhook Event Types

```ts
import {
  WebhookEvent,
  CheckoutWebhookEvent,
  isCheckoutPaid,
  isCheckoutFailed,
} from '@dalli/chargily-pay';

// Type guards narrow the event type
if (isCheckoutPaid(event)) {
  // event.data is typed as Checkout
  console.log(event.data.amount);
}
```

Available event types: `checkout.paid`, `checkout.failed`, `checkout.expired`, `checkout.canceled`, `checkout.processing`, `checkout.pending`.

## Error Handling

The SDK throws typed errors:

```ts
import { ChargilyApiError, ChargilyNetworkError } from '@dalli/chargily-pay';

try {
  await client.createCustomer({ name: '' });
} catch (error) {
  if (error instanceof ChargilyApiError) {
    // API returned an error (4xx/5xx)
    console.log(error.status);     // 422
    console.log(error.statusText); // 'Unprocessable Entity'
    console.log(error.body);       // { message: '...', errors: { ... } }
  } else if (error instanceof ChargilyNetworkError) {
    // Network/timeout error
    console.log(error.message);    // 'Request timed out'
    console.log(error.cause);      // Original error
  }
}
```

## Pagination

All list methods support pagination:

```ts
const page = await client.listCustomers({ per_page: 20, page: 2 });

console.log(page.data);          // Customer[]
console.log(page.current_page);  // 2
console.log(page.last_page);     // 5
```

`per_page` is clamped to 1-50, `page` minimum is 1.

## Logging

Pass any logger with `debug`, `info`, `warn`, `error` methods:

```ts
// Use console
const client = new ChargilyClient({ ..., logger: console });

// Use winston
import winston from 'winston';
const logger = winston.createLogger({ /* ... */ });
const client = new ChargilyClient({ ..., logger });

// Use pino
import pino from 'pino';
const client = new ChargilyClient({ ..., logger: pino() });
```

The SDK logs:
- `debug`: Every request (`GET balance`, `POST customers`)
- `warn`: Retry attempts with delay info
- `error`: API errors with status and body

## What's Different from @chargily/chargily-pay

| Issue | Original | This Fork |
|-------|----------|-----------|
| Update methods use POST | POST | PATCH (correct) |
| URL validation | None (accepts `httpmalicious`) | `new URL()` with protocol check |
| `verifySignature` throws | Throws on invalid | Returns `false` |
| Error handling | Generic errors | `ChargilyApiError` / `ChargilyNetworkError` |
| Timeouts | None | AbortController with configurable timeout |
| Retries | None | Exponential backoff on 429/5xx |
| Rate limiting | None | Token bucket (5 req/s default) |
| Pagination | `per_page` only | `per_page` + `page` with validation |
| Webhook DX | Manual verify + parse | `parseWebhookEvent` one-liner |
| TypeScript types | Several incorrect | All fixed and strict |
| Logging | None | Pluggable logger interface |
| Idempotency | None | `RequestOptions` with idempotency key |
| Tests | None | 51 tests with Vitest |
| CI | None | GitHub Actions (Node 18/20/22) |
| Linting | None | ESLint + Prettier |

## API Documentation

See the full Chargily Pay V2 API docs: [dev.chargily.com/pay-v2](https://dev.chargily.com/pay-v2/introduction)

## License

MIT
