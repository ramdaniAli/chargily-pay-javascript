import crypto from 'crypto';

/**
 * Verifies the signature of the incoming webhook request.
 * @param {Buffer} payload - The raw body buffer of the request.
 * @param {string} signature - The signature header from the webhook request.
 * @param {string} secretKey - Your Chargily API secret key.
 * @returns {boolean} - Returns true if the signature is valid, false otherwise.
 */
export function verifySignature(payload: Buffer, signature: string, secretKey: string): boolean {
  if (!signature) {
    return false;
  }

  const computedSignature = crypto.createHmac('sha256', secretKey).update(payload).digest('hex');

  const digest = Buffer.from(computedSignature, 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');

  if (
    signatureBuffer.length !== digest.length ||
    !crypto.timingSafeEqual(digest, signatureBuffer)
  ) {
    return false;
  }

  return true;
}
