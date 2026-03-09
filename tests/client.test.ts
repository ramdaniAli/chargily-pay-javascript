import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChargilyClient } from '../src/classes/client';
import { ChargilyApiError, ChargilyNetworkError } from '../src/errors';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('ChargilyClient', () => {
  let client: ChargilyClient;

  beforeEach(() => {
    client = new ChargilyClient({ api_key: 'test_key', mode: 'test' });
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: '123' }),
    });
  });

  describe('HTTP method correctness', () => {
    it('updateCustomer should use PATCH (already correct)', async () => {
      await client.updateCustomer('cust_123', { name: 'Updated' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('customers/cust_123'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('updateProduct should use PATCH', async () => {
      await client.updateProduct('prod_123', { name: 'Updated' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('products/prod_123'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('updatePrice should use PATCH', async () => {
      await client.updatePrice('price_123', { metadata: {} });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('prices/price_123'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('updatePaymentLink should use PATCH', async () => {
      await client.updatePaymentLink('pl_123', { name: 'Updated' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('payment-links/pl_123'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  describe('createCheckout validation', () => {
    it('should reject invalid URLs like httpmalicious', async () => {
      await expect(
        client.createCheckout({ success_url: 'httpmalicious', amount: 1000, currency: 'dzd' })
      ).rejects.toThrow();
    });

    it('should reject non-URL strings', async () => {
      await expect(
        client.createCheckout({ success_url: 'not-a-url', amount: 1000, currency: 'dzd' })
      ).rejects.toThrow();
    });

    it('should accept valid http URL', async () => {
      await client.createCheckout({ success_url: 'http://example.com', amount: 1000, currency: 'dzd' });
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should accept valid https URL', async () => {
      await client.createCheckout({ success_url: 'https://example.com', amount: 1000, currency: 'dzd' });
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should validate failure_url if provided', async () => {
      await expect(
        client.createCheckout({
          success_url: 'https://example.com',
          failure_url: 'not-a-url',
          amount: 1000,
          currency: 'dzd',
        })
      ).rejects.toThrow();
    });

    it('should validate webhook_endpoint if provided', async () => {
      await expect(
        client.createCheckout({
          success_url: 'https://example.com',
          webhook_endpoint: 'not-a-url',
          amount: 1000,
          currency: 'dzd',
        })
      ).rejects.toThrow();
    });
  });

  describe('API error handling', () => {
    it('should throw ChargilyApiError with parsed body on 4xx', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: () =>
          Promise.resolve({
            message: 'The name field is required.',
            errors: { name: ['The name field is required.'] },
          }),
      });

      try {
        await client.createCustomer({} as any);
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ChargilyApiError);
        const apiError = error as ChargilyApiError;
        expect(apiError.status).toBe(422);
        expect(apiError.body?.message).toBe('The name field is required.');
        expect(apiError.body?.errors?.name).toContain('The name field is required.');
      }
    });

    it('should throw ChargilyApiError even if error body is not JSON', async () => {
      const noRetryClient = new ChargilyClient({
        api_key: 'test_key',
        mode: 'test',
        maxRetries: 0,
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('not json')),
      });

      try {
        await noRetryClient.getBalance();
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ChargilyApiError);
        const apiError = error as ChargilyApiError;
        expect(apiError.status).toBe(500);
        expect(apiError.body).toBeNull();
      }
    });

    it('should throw ChargilyNetworkError on fetch failure', async () => {
      const noRetryClient = new ChargilyClient({
        api_key: 'test_key',
        mode: 'test',
        maxRetries: 0,
      });

      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      try {
        await noRetryClient.getBalance();
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ChargilyNetworkError);
        expect((error as ChargilyNetworkError).message).toContain('Network timeout');
      }
    });
  });

  describe('Constructor validation', () => {
    it('should throw if api_key is empty', () => {
      expect(() => new ChargilyClient({ api_key: '', mode: 'test' })).toThrow(
        'api_key is required'
      );
    });

    it('should throw if mode is invalid', () => {
      expect(
        () => new ChargilyClient({ api_key: 'key', mode: 'invalid' as any })
      ).toThrow("mode must be 'test' or 'live'");
    });

    it('should accept valid test config', () => {
      expect(
        () => new ChargilyClient({ api_key: 'key', mode: 'test' })
      ).not.toThrow();
    });

    it('should accept valid live config', () => {
      expect(
        () => new ChargilyClient({ api_key: 'key', mode: 'live' })
      ).not.toThrow();
    });
  });

  describe('Retry with exponential backoff', () => {
    it('should retry on 429 and eventually succeed', async () => {
      const client429 = new ChargilyClient({
        api_key: 'test_key',
        mode: 'test',
        retryDelay: 1,
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: () => Promise.resolve(null),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'success' }),
        });

      const result = await client429.getBalance();
      expect(result).toEqual({ id: 'success' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 and eventually succeed', async () => {
      const client503 = new ChargilyClient({
        api_key: 'test_key',
        mode: 'test',
        retryDelay: 1,
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
          json: () => Promise.resolve({ id: 'recovered' }),
        });

      const result = await client503.getBalance();
      expect(result).toEqual({ id: 'recovered' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on 4xx (non-429)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: () => Promise.resolve({ message: 'validation error' }),
      });

      await expect(client.getBalance()).rejects.toThrow(ChargilyApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw after maxRetries exhausted', async () => {
      const clientRetry = new ChargilyClient({
        api_key: 'test_key',
        mode: 'test',
        maxRetries: 2,
        retryDelay: 1,
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve(null),
      });

      await expect(clientRetry.getBalance()).rejects.toThrow(ChargilyApiError);
      expect(mockFetch).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should retry on network errors then succeed', async () => {
      const clientNet = new ChargilyClient({
        api_key: 'test_key',
        mode: 'test',
        retryDelay: 1,
      });

      mockFetch
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'ok' }),
        });

      const result = await clientNet.getBalance();
      expect(result).toEqual({ id: 'ok' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw ChargilyNetworkError after network retries exhausted', async () => {
      const clientNet = new ChargilyClient({
        api_key: 'test_key',
        mode: 'test',
        maxRetries: 1,
        retryDelay: 1,
      });

      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(clientNet.getBalance()).rejects.toThrow(ChargilyNetworkError);
      expect(mockFetch).toHaveBeenCalledTimes(2); // initial + 1 retry
    });
  });

  describe('Idempotency key', () => {
    it('should send Idempotency-Key header when provided', async () => {
      await client.createCustomer(
        { name: 'Test' },
        { idempotencyKey: 'unique-key-123' }
      );

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers['Idempotency-Key']).toBe('unique-key-123');
    });

    it('should NOT send Idempotency-Key header when not provided', async () => {
      await client.createCustomer({ name: 'Test' });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers['Idempotency-Key']).toBeUndefined();
    });
  });

  describe('Timeout', () => {
    it('should use AbortController signal in fetch', async () => {
      await client.getBalance();

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('Pagination', () => {
    it('listCustomers should support page parameter', async () => {
      await client.listCustomers({ per_page: 5, page: 3 });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('customers?per_page=5&page=3'),
        expect.anything()
      );
    });

    it('listCustomers should default to page 1, per_page 10', async () => {
      await client.listCustomers();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('customers?per_page=10&page=1'),
        expect.anything()
      );
    });

    it('should clamp per_page to minimum 1', async () => {
      await client.listCustomers({ per_page: 0 });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('per_page=1'),
        expect.anything()
      );
    });

    it('should clamp per_page to maximum 50', async () => {
      await client.listCustomers({ per_page: 999 });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('per_page=50'),
        expect.anything()
      );
    });

    it('should clamp page to minimum 1', async () => {
      await client.listCustomers({ page: -5 });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1'),
        expect.anything()
      );
    });

    it('listProducts should support pagination', async () => {
      await client.listProducts({ per_page: 20, page: 2 });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('products?per_page=20&page=2'),
        expect.anything()
      );
    });

    it('listPaymentLinks should support pagination', async () => {
      await client.listPaymentLinks({ page: 4 });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('payment-links?per_page=10&page=4'),
        expect.anything()
      );
    });
  });
});
