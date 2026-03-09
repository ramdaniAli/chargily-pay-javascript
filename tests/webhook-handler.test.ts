import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { parseWebhookEvent, WebhookSignatureError } from '../src/webhook';

const SECRET = 'test_secret_key';

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

describe('parseWebhookEvent', () => {
  const validPayload = JSON.stringify({
    id: 'evt_1',
    type: 'checkout.paid',
    data: { id: 'co_1', status: 'paid' },
    created_at: 1000,
    livemode: false,
  });

  it('should parse and return a valid webhook event', () => {
    const signature = sign(validPayload);
    const event = parseWebhookEvent(validPayload, signature, SECRET);
    expect(event.id).toBe('evt_1');
    expect(event.type).toBe('checkout.paid');
  });

  it('should work with Buffer payload', () => {
    const buffer = Buffer.from(validPayload, 'utf8');
    const signature = sign(validPayload);
    const event = parseWebhookEvent(buffer, signature, SECRET);
    expect(event.id).toBe('evt_1');
  });

  it('should throw WebhookSignatureError if signature is missing', () => {
    expect(() => parseWebhookEvent(validPayload, undefined, SECRET)).toThrow(WebhookSignatureError);
    expect(() => parseWebhookEvent(validPayload, null, SECRET)).toThrow(WebhookSignatureError);
    expect(() => parseWebhookEvent(validPayload, '', SECRET)).toThrow(WebhookSignatureError);
  });

  it('should throw WebhookSignatureError if signature is invalid', () => {
    expect(() => parseWebhookEvent(validPayload, 'bad_signature', SECRET)).toThrow(
      WebhookSignatureError
    );
  });

  it('should throw if body is not valid JSON', () => {
    const badBody = 'not json';
    const signature = sign(badBody);
    expect(() => parseWebhookEvent(badBody, signature, SECRET)).toThrow(
      'Failed to parse webhook event body as JSON'
    );
  });
});
