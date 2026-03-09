import { Checkout } from './data';

export type WebhookEventType =
  | 'checkout.paid'
  | 'checkout.failed'
  | 'checkout.expired'
  | 'checkout.canceled'
  | 'checkout.processing'
  | 'checkout.pending';

export interface WebhookEvent<T = unknown> {
  id: string;
  type: WebhookEventType;
  data: T;
  created_at: number;
  livemode: boolean;
}

export interface CheckoutWebhookEvent extends WebhookEvent<Checkout> {
  type: Extract<WebhookEventType, `checkout.${string}`>;
}

export function isCheckoutPaid(
  event: WebhookEvent
): event is WebhookEvent<Checkout> & { type: 'checkout.paid' } {
  return event.type === 'checkout.paid';
}

export function isCheckoutFailed(
  event: WebhookEvent
): event is WebhookEvent<Checkout> & { type: 'checkout.failed' } {
  return event.type === 'checkout.failed';
}
