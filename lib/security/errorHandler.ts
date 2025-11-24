import { NextResponse } from 'next/server';

/**
 * Centralized API error handler
 * - Logs errors to console
 * - Returns generic error in production (prevents info leakage)
 * - Returns detailed error in development for debugging
 *
 * @param error - The error that occurred
 * @param context - A string identifying where the error occurred (e.g., 'create-service')
 */
export function handleApiError(error: unknown, context: string): NextResponse {
  // Log the full error for debugging
  console.error(`[${context}]`, error);

  // In production, return generic error to prevent information leakage
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }

  // In development, return detailed error for debugging
  if (error instanceof Error) {
    // Handle known error types with appropriate status codes
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    if (error.message === 'Not found') {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: error.message,
        stack: error.stack,
        context,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      error: 'Unknown error occurred',
      details: String(error),
      context,
    },
    { status: 500 }
  );
}

/**
 * Create a standardized error response for validation failures
 */
export function createValidationErrorResponse(
  fieldErrors: Record<string, string[] | undefined>
): NextResponse {
  return NextResponse.json(
    {
      error: 'Validation failed',
      details: fieldErrors,
    },
    { status: 400 }
  );
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}
