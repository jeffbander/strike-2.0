# Strike Prep App - Developer Notes

## Project Overview
Multi-tenant healthcare staffing platform for strike coverage planning built with Next.js 16, Clerk auth, and Supabase.

## Key Patterns

### API Routes with Dynamic Params

**Important:** The `withCsrf` and `withRateLimit` wrappers in `lib/security/` do NOT pass through route params. For dynamic routes like `[id]/route.ts`, implement CSRF checking inline:

```typescript
// DON'T do this for dynamic routes - params won't be passed:
export const DELETE = withRateLimit(withCsrf(deleteHandler));

// DO this instead:
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Verify CSRF inline
  const token = request.headers.get('X-CSRF-Token');
  const validCsrf = await verifyCsrfToken(token);
  if (!validCsrf) {
    return NextResponse.json({ error: 'Invalid or missing CSRF token' }, { status: 403 });
  }

  const { id } = await params;
  // ... rest of handler
}
```

### CSRF Token Flow

Frontend mutation requests must:
1. Fetch token: `GET /api/csrf` → `{ csrfToken: "..." }`
2. Include in header: `'X-CSRF-Token': csrfToken`

```typescript
const csrfRes = await fetch('/api/csrf');
const { csrfToken } = await csrfRes.json();

await fetch('/api/resource', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify(data),
});
```

### Authentication

- Uses Clerk for auth
- API routes use `requireRole()` from `lib/auth/authorization`
- In dev mode, defaults to `super_admin` if no valid role (see console warnings)
- Role hierarchy: `super_admin` > `health_system_admin` > `hospital_admin` > `departmental_admin`

### Button Component Variants

The Button component (`components/ui/button.tsx`) supports these variants:
- `primary` (default)
- `secondary`
- `danger` (NOT "destructive")
- `success`
- `ghost`
- `outline`
- `link`

Sizes: `sm`, `md`, `lg`, `icon`

### Database Patterns

- Soft deletes: Set `is_active = false` rather than hard delete
- Check for dependent records before deletion
- Audit logging via `logAudit()` for all mutations

### File Structure

```
app/
  (dashboard)/     # Authenticated pages with sidebar
  api/             # API routes
    [resource]/
      route.ts     # GET (list), POST (create)
      [id]/
        route.ts   # GET (single), DELETE, PATCH
lib/
  security/        # CSRF, rate limiting, validation
  auth/            # Authorization helpers
  supabase/        # Database client
components/
  ui/              # Reusable UI components
```

## Common Issues

### "Unexpected end of JSON input"
Usually means API returned empty response. Check:
1. Route params not being passed (see wrapper issue above)
2. Middleware rejecting request silently

### API returns 404 when route file exists
Check if middleware is redirecting unauthenticated requests to sign-in.

### Tests fail with auth issues
Playwright tests need authentication setup. See `tests/auth.setup.ts`.
