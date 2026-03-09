import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChargilyClient } from '../src/classes/client';
import { ChargilyLogger } from '../src/logger';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Logger integration', () => {
  let logger: ChargilyLogger;

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: '123' }),
    });

    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  it('should call logger.debug on request', async () => {
    const client = new ChargilyClient({
      api_key: 'test_key',
      mode: 'test',
      logger,
      maxRequestsPerSecond: 0,
    });

    await client.getBalance();
    expect(logger.debug).toHaveBeenCalledWith('GET balance', expect.any(Object));
  });

  it('should call logger.error on API error', async () => {
    const client = new ChargilyClient({
      api_key: 'test_key',
      mode: 'test',
      logger,
      maxRetries: 0,
      maxRequestsPerSecond: 0,
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: () => Promise.resolve({ message: 'error' }),
    });

    try {
      await client.createCustomer({} as any);
    } catch {
      // expected
    }

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('API error 422'),
      expect.any(Object)
    );
  });

  it('should call logger.warn on retry', async () => {
    const client = new ChargilyClient({
      api_key: 'test_key',
      mode: 'test',
      logger,
      retryDelay: 1,
      maxRequestsPerSecond: 0,
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: () => Promise.resolve(null),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'ok' }),
      });

    await client.getBalance();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Retry attempt'),
      expect.any(Object)
    );
  });

  it('should not fail when no logger is provided', async () => {
    const client = new ChargilyClient({
      api_key: 'test_key',
      mode: 'test',
    });

    await expect(client.getBalance()).resolves.toBeDefined();
  });
});
