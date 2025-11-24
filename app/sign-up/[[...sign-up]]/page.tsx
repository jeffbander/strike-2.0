'use client';

import { SignUp, useAuth } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { Building2, Shield, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface InvitationDetails {
  email: string;
  name?: string;
  role: string;
  organization?: {
    id: string;
    name: string;
    short_code?: string;
  };
}

function SignUpContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Validate invitation token
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    async function validateToken() {
      try {
        const res = await fetch(`/api/invitations/accept?token=${token}`);
        const data = await res.json();

        if (data.valid) {
          setInvitation(data.invitation);
        } else {
          setError(data.error || 'Invalid invitation');
        }
      } catch (err) {
        setError('Failed to validate invitation');
      } finally {
        setLoading(false);
      }
    }

    validateToken();
  }, [token]);

  // After signing in with invitation, accept the invitation
  useEffect(() => {
    if (isSignedIn && token && invitation && !accepting) {
      acceptInvitation();
    }
  }, [isSignedIn, token, invitation]);

  async function acceptInvitation() {
    if (!token) return;

    setAccepting(true);
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (data.success) {
        // Redirect to dashboard
        router.push('/dashboard?welcome=true');
      } else {
        setError(data.error || 'Failed to accept invitation');
        setAccepting(false);
      }
    } catch (err) {
      setError('Failed to accept invitation');
      setAccepting(false);
    }
  }

  const formatRole = (role: string) => {
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (accepting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">Setting up your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
      <div className="w-full max-w-md px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="h-7 w-7 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Strike Prep</h1>
          <p className="text-gray-600 mt-1">
            {invitation ? 'Accept your invitation' : 'Create your account'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">{error}</p>
              {token && (
                <p className="text-sm text-red-600 mt-1">
                  Please contact your administrator for a new invitation.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Invitation Details */}
        {invitation && !error && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">
                  You have been invited!
                </p>
                <div className="mt-2 space-y-1 text-sm text-green-700">
                  <p><strong>Role:</strong> {formatRole(invitation.role)}</p>
                  {invitation.organization && (
                    <p className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      <strong>Organization:</strong> {invitation.organization.name}
                    </p>
                  )}
                  <p><strong>Email:</strong> {invitation.email}</p>
                </div>
                <p className="text-xs text-green-600 mt-2">
                  Sign up with the email above to accept your invitation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No Invitation Warning */}
        {!token && !error && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Invitation Required
              </p>
              <p className="text-sm text-amber-600 mt-1">
                You need an invitation to sign up. Contact your organization
                administrator to request access.
              </p>
            </div>
          </div>
        )}

        {/* Clerk SignUp */}
        {(invitation || !token) && !error && (
          <SignUp
            appearance={{
              elements: {
                rootBox: 'mx-auto',
                card: 'shadow-lg border border-gray-200',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                socialButtonsBlockButton: 'hidden',
                dividerLine: 'hidden',
                dividerText: 'hidden',
                formFieldInput: 'border-gray-300 focus:border-primary focus:ring-primary',
                formButtonPrimary: 'bg-primary hover:bg-primary/90',
              },
            }}
            initialValues={
              invitation
                ? {
                    emailAddress: invitation.email,
                    firstName: invitation.name?.split(' ')[0] || '',
                    lastName: invitation.name?.split(' ').slice(1).join(' ') || '',
                  }
                : undefined
            }
          />
        )}

        {/* Sign In Link */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{' '}
          <a href="/sign-in" className="text-primary hover:underline font-medium">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <SignUpContent />
    </Suspense>
  );
}
