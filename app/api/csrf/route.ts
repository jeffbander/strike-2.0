import { NextResponse } from 'next/server';
import { generateCsrfToken } from '@/lib/security/csrf';

/**
 * GET /api/csrf
 * Generate a new CSRF token for client-side use
 * This endpoint is public (no auth required)
 */
export async function GET() {
  const csrfToken = generateCsrfToken();

  return NextResponse.json(
    { csrfToken },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
