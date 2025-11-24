import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET!;

if (!CSRF_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('CSRF_SECRET environment variable is required in production');
}

/**
 * Generate a CSRF token using HMAC-SHA256
 * Token format: {randomToken}.{signature}
 */
export function generateCsrfToken(): string {
  const secret = CSRF_SECRET || 'development-secret-not-for-production';
  const token = randomBytes(32).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(token)
    .digest('base64url');

  return `${token}.${signature}`;
}

/**
 * Verify a CSRF token
 * @param token - The token to verify (format: {randomToken}.{signature})
 * @returns True if valid, false otherwise
 */
export async function verifyCsrfToken(token: string | null): Promise<boolean> {
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [tokenPart, signaturePart] = parts;
  if (!tokenPart || !signaturePart) return false;

  const secret = CSRF_SECRET || 'development-secret-not-for-production';
  const expectedSignature = createHmac('sha256', secret)
    .update(tokenPart)
    .digest('base64url');

  // Use timing-safe comparison to prevent timing attacks
  try {
    const sigBuffer = Buffer.from(signaturePart, 'base64url');
    const expectedBuffer = Buffer.from(expectedSignature, 'base64url');

    if (sigBuffer.length !== expectedBuffer.length) return false;

    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}
