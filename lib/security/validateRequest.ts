import { NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';

type ValidationSuccess<T> = {
  success: true;
  data: T;
};

type ValidationFailure = {
  success: false;
  response: NextResponse;
};

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Validate request data against a Zod schema
 * Returns either the validated data or a NextResponse with validation errors
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Object with success boolean and either data or error response
 *
 * @example
 * const validation = validateRequest(createServiceSchema, body);
 * if (!validation.success) return validation.response;
 * // validation.data is now typed and validated
 */
export function validateRequest<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false as const,
      response: NextResponse.json(
        {
          error: 'Validation failed',
          details: formatZodErrors(result.error),
        },
        { status: 400 }
      ),
    };
  }

  return {
    success: true as const,
    data: result.data,
  };
}

/**
 * Format Zod errors into a more readable structure
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    const key = path || '_root';

    if (!fieldErrors[key]) {
      fieldErrors[key] = [];
    }
    fieldErrors[key].push(issue.message);
  }

  return fieldErrors;
}

/**
 * Validate and parse JSON body from request
 * Handles JSON parsing errors gracefully
 */
export async function parseAndValidate<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json();
    return validateRequest(schema, body);
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      ),
    };
  }
}
