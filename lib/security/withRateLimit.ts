import { NextRequest, NextResponse } from 'next/server';

type Handler = (req: NextRequest) => Promise<NextResponse>;

// In-memory store for rate limiting
// In production, consider using Redis for distributed rate limiting
const requests = new Map<string, number[]>();

// Rate limit configuration
// More generous in development, stricter in production
const isDev = process.env.NODE_ENV === 'development';
const DEFAULT_LIMIT = isDev ? 100 : 30; // requests per window
const DEFAULT_WINDOW = 60 * 1000; // 1 minute in milliseconds

interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
}

/**
 * Rate limiting middleware wrapper
 * Limits requests per IP address within a time window
 *
 * Default: 5 requests per minute
 *
 * @param handler - The route handler to wrap
 * @param options - Optional configuration for limit and window
 */
export function withRateLimit(handler: Handler, options?: RateLimitOptions): Handler {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW;

  return async (request: NextRequest) => {
    // Get client IP from headers (handle proxies)
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';

    const now = Date.now();

    // Get recent requests and filter to window
    const recentRequests = (requests.get(ip) || []).filter(
      (time) => now - time < windowMs
    );

    // Check if limit exceeded
    if (recentRequests.length >= limit) {
      const retryAfter = Math.ceil((recentRequests[0] + windowMs - now) / 1000);

      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil((recentRequests[0] + windowMs) / 1000)),
          },
        }
      );
    }

    // Add current request to tracking
    recentRequests.push(now);
    requests.set(ip, recentRequests);

    // Add rate limit headers to successful responses
    const response = await handler(request);
    response.headers.set('X-RateLimit-Limit', String(limit));
    response.headers.set('X-RateLimit-Remaining', String(limit - recentRequests.length));

    return response;
  };
}

// Cleanup old entries periodically (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, times] of requests.entries()) {
      const filtered = times.filter((time) => now - time < DEFAULT_WINDOW);
      if (filtered.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, filtered);
      }
    }
  }, 5 * 60 * 1000);
}
