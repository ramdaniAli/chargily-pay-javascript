import { verifySignature } from './utils';
import { WebhookEvent } from './types/webhook';

export class WebhookSignatureError extends Error {
  constructor(message: string = 'Invalid webhook signature') {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

/**
 * Parses and verifies a webhook event from Chargily.
 * Works with any framework - just pass the raw body and signature header.
 *
 * @param rawBody - The raw request body as a string or Buffer.
 * @param signature - The value of the 'signature' header from the request.
 * @param secretKey - Your Chargily API secret key used for HMAC verification.
 * @returns The parsed and verified WebhookEvent.
 * @throws {WebhookSignatureError} If the signature is missing or invalid.
 *
 * @example Express
 * ```ts
 * app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
 *   try {
 *     const event = parseWebhookEvent(req.body, req.headers['signature'], SECRET);
 *     if (isCheckoutPaid(event)) {
 *       // handle payment
 *     }
 *     res.sendStatus(200);
 *   } catch (err) {
 *     res.sendStatus(400);
 *   }
 * });
 * ```
 */
export function parseWebhookEvent(
  rawBody: string | Buffer,
  signature: string | undefined | null,
  secretKey: string
): WebhookEvent {
  if (!signature) {
    throw new WebhookSignatureError('Missing webhook signature header');
  }

  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');

  if (!verifySignature(payload, signature, secretKey)) {
    throw new WebhookSignatureError('Invalid webhook signature');
  }

  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;

  try {
    return JSON.parse(body) as WebhookEvent;
  } catch {
    throw new Error('Failed to parse webhook event body as JSON');
  }
}
