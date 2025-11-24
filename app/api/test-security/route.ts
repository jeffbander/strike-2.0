import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { withCsrf } from '@/lib/security/withCsrf';
import { validateRequest } from '@/lib/security/validateRequest';
import { handleApiError } from '@/lib/security/errorHandler';
import { requireAuth } from '@/lib/auth/authorization';
import { logAudit } from '@/lib/audit/logger';
import { z } from 'zod';

/**
 * Test schema for validating request body
 */
const testSchema = z.object({
  message: z.string().min(1, 'Message is required').max(100, 'Message too long'),
});

/**
 * POST /api/test-security
 * Test endpoint to verify the entire security stack is working
 *
 * Security layers tested:
 * 1. Rate limiting (5 req/min)
 * 2. CSRF protection (requires X-CSRF-Token header)
 * 3. Authentication (requires Clerk session)
 * 4. Input validation (Zod schema)
 * 5. Audit logging
 * 6. Error handling
 */
async function testHandler(request: NextRequest) {
  try {
    // 1. Authentication check
    const userId = await requireAuth();

    // 2. Input validation
    const body = await request.json();
    const validation = validateRequest(testSchema, body);
    if (!validation.success) return validation.response;

    // 3. Audit logging
    await logAudit({
      action: 'CREATE',
      resourceType: 'HEALTH_SYSTEM', // Using valid type for test
      changes: { test: true, message: validation.data.message },
    });

    // 4. Success response
    return NextResponse.json({
      success: true,
      message: 'Security stack working correctly!',
      data: {
        userId,
        receivedMessage: validation.data.message,
        securityChecks: {
          rateLimiting: 'PASSED',
          csrfProtection: 'PASSED',
          authentication: 'PASSED',
          inputValidation: 'PASSED',
          auditLogging: 'PASSED',
        },
      },
    });
  } catch (error) {
    return handleApiError(error, 'test-security');
  }
}

// Apply security middleware
export const POST = withRateLimit(withCsrf(testHandler));

/**
 * GET /api/test-security
 * Returns security stack status without authentication
 * Useful for health checks
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Security test endpoint available',
    instructions: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'Get from /api/csrf first',
      },
      body: {
        message: 'Your test message',
      },
      authentication: 'Clerk session required',
    },
  });
}
