import { describe, it, expect } from 'vitest';
import {
  isCheckoutPaid,
  isCheckoutFailed,
  WebhookEvent,
} from '../src/types/webhook';

describe('Webhook event type guards', () => {
  const paidEvent: WebhookEvent = {
    id: 'evt_1',
    type: 'checkout.paid',
    data: { id: 'co_1', status: 'paid' },
    created_at: 1,
    livemode: false,
  };
  const failedEvent: WebhookEvent = {
    id: 'evt_2',
    type: 'checkout.failed',
    data: { id: 'co_2', status: 'failed' },
    created_at: 1,
    livemode: false,
  };

  it('isCheckoutPaid returns true for paid events', () => {
    expect(isCheckoutPaid(paidEvent)).toBe(true);
    expect(isCheckoutPaid(failedEvent)).toBe(false);
  });

  it('isCheckoutFailed returns true for failed events', () => {
    expect(isCheckoutFailed(failedEvent)).toBe(true);
    expect(isCheckoutFailed(paidEvent)).toBe(false);
  });
});
