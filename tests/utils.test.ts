import { describe, it, expect, vi } from 'vitest';
import { verifySignature } from '../src/utils';
import crypto from 'crypto';

describe('verifySignature', () => {
  const secretKey = 'test_secret_key';
  const payload = Buffer.from('{"id":"checkout_123","status":"paid"}');
  const validSignature = crypto.createHmac('sha256', secretKey).update(payload).digest('hex');

  it('should return true for valid signature', () => {
    expect(verifySignature(payload, validSignature, secretKey)).toBe(true);
  });

  it('should return false for invalid signature (not throw)', () => {
    expect(verifySignature(payload, 'invalid_signature', secretKey)).toBe(false);
  });

  it('should return false for empty signature', () => {
    expect(verifySignature(payload, '', secretKey)).toBe(false);
  });

  it('should not log to console', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    verifySignature(payload, validSignature, secretKey);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
