# Contributing to @dalli/chargily-pay

Thanks for your interest in contributing! This guide will help you get started.

## Prerequisites

- **Node.js >= 18** (we use native `fetch`)
- **npm** (comes with Node.js)
- **Git**

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork:**

```bash
git clone https://github.com/YOUR_USERNAME/chargily-pay-javascript.git
cd chargily-pay-javascript
```

3. **Install dependencies:**

```bash
npm install --legacy-peer-deps
```

4. **Run the tests** to make sure everything works:

```bash
npm test
```

## Development Workflow

### Branch Naming

- `fix/description` - Bug fixes
- `feat/description` - New features
- `chore/description` - Maintenance, tooling, CI
- `docs/description` - Documentation only

### Commands

| Command | Description |
|---|---|
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run build` | Compile TypeScript to `lib/` |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |

### Writing Code

1. **Create a branch** from `main`:

```bash
git checkout -b feat/my-feature
```

2. **Write tests first** (TDD) in `tests/`. We use [Vitest](https://vitest.dev/).

3. **Implement your changes** in `src/`.

4. **Run all checks:**

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

5. **Commit** with a clear message:

```
feat: add support for refunds
fix: handle empty response body in webhook parsing
chore: update vitest to v3
docs: add refund API examples to README
```

We follow [Conventional Commits](https://www.conventionalcommits.org/).

6. **Push and open a Pull Request** against `main`.

### Code Style

- **TypeScript** - strict mode enabled
- **Prettier** handles formatting (single quotes, trailing commas, 100 char width)
- **ESLint** catches issues - `@typescript-eslint/no-explicit-any` is a warning, not an error (metadata fields need `any`)
- Keep it simple - no over-engineering, no premature abstractions

### Testing Guidelines

- Mock `global.fetch` for API client tests (see `tests/client.test.ts`)
- Use `crypto` for webhook signature tests (see `tests/webhook-handler.test.ts`)
- Test both success and error paths
- For time-sensitive tests (rate limiter), use reasonable tolerances

## Project Structure

```
src/
  classes/client.ts    # ChargilyClient - main API client
  types/
    data.ts            # Response types (Customer, Product, Checkout, etc.)
    param.ts           # Request parameter types
    response.ts        # List/Delete response types
    webhook.ts         # Webhook event types and type guards
  consts/index.ts      # API base URLs
  errors.ts            # ChargilyApiError, ChargilyNetworkError
  logger.ts            # ChargilyLogger interface
  rate-limiter.ts      # Token-bucket rate limiter
  webhook.ts           # parseWebhookEvent helper
  utils/index.ts       # verifySignature
  index.ts             # Public exports

tests/
  client.test.ts       # API client tests (33 tests)
  webhook.test.ts      # Webhook type guard tests
  webhook-handler.test.ts  # parseWebhookEvent tests
  utils.test.ts        # verifySignature tests
  logger.test.ts       # Logger integration tests
  rate-limiter.test.ts # Rate limiter tests
```

## Reporting Bugs

Open an issue at [GitHub Issues](https://github.com/ramdaniAli/chargily-pay-javascript/issues) with:

- Steps to reproduce
- Expected vs actual behavior
- Node.js version
- SDK version (`npm list @dalli/chargily-pay`)

## Suggesting Features

Open an issue with the `enhancement` label describing:

- What problem it solves
- Proposed API / usage example
- Any alternatives you considered

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
