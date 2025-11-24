import { NextRequest, NextResponse } from 'next/server';
import { verifyCsrfToken } from './csrf';

type Handler = (req: NextRequest) => Promise<NextResponse>;

/**
 * CSRF protection middleware wrapper
 * Verifies X-CSRF-Token header for non-safe HTTP methods (POST, PUT, DELETE, PATCH)
 * Safe methods (GET, HEAD, OPTIONS) pass through without verification
 */
export function withCsrf(handler: Handler): Handler {
  return async (request: NextRequest) => {
    // Safe methods don't need CSRF protection
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return handler(request);
    }

    const token = request.headers.get('X-CSRF-Token');
    const valid = await verifyCsrfToken(token);

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid or missing CSRF token' },
        { status: 403 }
      );
    }

    return handler(request);
  };
}
