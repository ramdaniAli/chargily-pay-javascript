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
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('not json')),
      });

      try {
        await client.getBalance();
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ChargilyApiError);
        const apiError = error as ChargilyApiError;
        expect(apiError.status).toBe(500);
        expect(apiError.body).toBeNull();
      }
    });

    it('should throw ChargilyNetworkError on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      try {
        await client.getBalance();
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ChargilyNetworkError);
        expect((error as ChargilyNetworkError).message).toContain('Network timeout');
      }
    });
  });
});
