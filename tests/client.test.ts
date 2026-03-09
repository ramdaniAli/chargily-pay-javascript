import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChargilyClient } from '../src/classes/client';

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
});
