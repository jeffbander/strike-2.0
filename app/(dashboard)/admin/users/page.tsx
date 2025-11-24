'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  Users,
  Mail,
  Shield,
  Building2,
  Building,
  Layers,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Copy,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Invitation {
  id: string;
  email: string;
  name?: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  token: string;
  health_systems?: { id: string; name: string };
  hospitals?: { id: string; name: string; short_code: string };
  departments?: { id: string; name: string };
}

interface HealthSystem {
  id: string;
  name: string;
}

interface Hospital {
  id: string;
  name: string;
  short_code: string;
  health_system_id: string;
}

interface Department {
  id: string;
  name: string;
  hospital_id: string;
}

export default function AdminUsersPage() {
  const { user } = useUser();
  const userRole = user?.publicMetadata?.role as string;

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [healthSystems, setHealthSystems] = useState<HealthSystem[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New invitation form
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: '',
    health_system_id: '',
    hospital_id: '',
    department_id: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdInvitation, setCreatedInvitation] = useState<{
    signupUrl: string;
  } | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const [invRes, hsRes, hospRes, deptRes] = await Promise.all([
        fetch('/api/invitations'),
        fetch('/api/health-systems'),
        fetch('/api/hospitals'),
        fetch('/api/departments'),
      ]);

      if (invRes.ok) {
        const data = await invRes.json();
        setInvitations(data.invitations || []);
      }

      if (hsRes.ok) {
        const data = await hsRes.json();
        setHealthSystems(data.healthSystems || []);
      }

      if (hospRes.ok) {
        const data = await hospRes.json();
        setHospitals(data.hospitals || []);
      }

      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(data.departments || []);
      }
    } catch (err) {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name || undefined,
          role: formData.role,
          health_system_id: formData.health_system_id || undefined,
          hospital_id: formData.hospital_id || undefined,
          department_id: formData.department_id || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setCreatedInvitation({ signupUrl: data.invitation.signupUrl });
        fetchData();
      } else {
        setSubmitError(data.error || 'Failed to create invitation');
      }
    } catch (err) {
      setSubmitError('Failed to create invitation');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Are you sure you want to revoke this invitation?')) return;

    try {
      const res = await fetch(`/api/invitations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'revoked' }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to revoke:', err);
    }
  }

  function resetForm() {
    setFormData({
      email: '',
      name: '',
      role: '',
      health_system_id: '',
      hospital_id: '',
      department_id: '',
    });
    setSubmitError(null);
    setCreatedInvitation(null);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'health_system_admin':
        return <Building2 className="h-4 w-4" />;
      case 'hospital_admin':
        return <Building className="h-4 w-4" />;
      case 'departmental_admin':
        return <Layers className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3" /> Pending
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3" /> Accepted
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <AlertCircle className="h-3 w-3" /> Expired
          </span>
        );
      case 'revoked':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3" /> Revoked
          </span>
        );
      default:
        return null;
    }
  };

  const formatRole = (role: string) => {
    return role
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Determine available roles based on user's role
  const getAvailableRoles = () => {
    switch (userRole) {
      case 'super_admin':
        return ['health_system_admin', 'hospital_admin', 'departmental_admin'];
      case 'health_system_admin':
        return ['hospital_admin'];
      case 'hospital_admin':
        return ['departmental_admin'];
      case 'departmental_admin':
        return ['departmental_admin'];
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600">Invite and manage users in your organization</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {createdInvitation ? 'Invitation Created' : 'Invite New User'}
                </DialogTitle>
              </DialogHeader>

              {createdInvitation ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800 font-medium mb-2">
                      Invitation created successfully!
                    </p>
                    <p className="text-sm text-green-700">
                      Share this link with the user to complete their signup:
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={createdInvitation.signupUrl}
                      readOnly
                      className="text-sm"
                    />
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(createdInvitation.signupUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }} className="w-full">
                    Done
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {submitError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                      {submitError}
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium">Email *</label>
                    <Input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="user@example.com"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="John Smith"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Role *</label>
                    <select
                      required
                      value={formData.role}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          role: e.target.value,
                          health_system_id: '',
                          hospital_id: '',
                          department_id: '',
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Select role...</option>
                      {getAvailableRoles().map((role) => (
                        <option key={role} value={role}>
                          {formatRole(role)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formData.role === 'health_system_admin' && (
                    <div>
                      <label className="text-sm font-medium">Health System *</label>
                      <select
                        required
                        value={formData.health_system_id}
                        onChange={(e) =>
                          setFormData({ ...formData, health_system_id: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="">Select health system...</option>
                        {healthSystems.map((hs) => (
                          <option key={hs.id} value={hs.id}>
                            {hs.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.role === 'hospital_admin' && (
                    <div>
                      <label className="text-sm font-medium">Hospital *</label>
                      <select
                        required
                        value={formData.hospital_id}
                        onChange={(e) =>
                          setFormData({ ...formData, hospital_id: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="">Select hospital...</option>
                        {hospitals.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.short_code})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.role === 'departmental_admin' && (
                    <div>
                      <label className="text-sm font-medium">Department *</label>
                      <select
                        required
                        value={formData.department_id}
                        onChange={(e) =>
                          setFormData({ ...formData, department_id: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="">Select department...</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Create Invitation
                      </>
                    )}
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{invitations.length}</p>
                <p className="text-sm text-gray-600">Total Invitations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {invitations.filter((i) => i.status === 'pending').length}
                </p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {invitations.filter((i) => i.status === 'accepted').length}
                </p>
                <p className="text-sm text-gray-600">Accepted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {invitations.filter((i) => i.status === 'revoked' || i.status === 'expired').length}
                </p>
                <p className="text-sm text-gray-600">Revoked/Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invitations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 mb-4">
              {error}
            </div>
          )}

          {invitations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No invitations yet</p>
              <p className="text-sm">Click "Invite User" to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-sm text-gray-600">Email</th>
                    <th className="pb-3 font-medium text-sm text-gray-600">Name</th>
                    <th className="pb-3 font-medium text-sm text-gray-600">Role</th>
                    <th className="pb-3 font-medium text-sm text-gray-600">Organization</th>
                    <th className="pb-3 font-medium text-sm text-gray-600">Status</th>
                    <th className="pb-3 font-medium text-sm text-gray-600">Created</th>
                    <th className="pb-3 font-medium text-sm text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="py-3 text-sm">{inv.email}</td>
                      <td className="py-3 text-sm text-gray-600">{inv.name || '-'}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 text-sm">
                          {getRoleIcon(inv.role)}
                          {formatRole(inv.role)}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-gray-600">
                        {inv.health_systems?.name ||
                          inv.hospitals?.name ||
                          inv.departments?.name ||
                          '-'}
                      </td>
                      <td className="py-3">{getStatusBadge(inv.status)}</td>
                      <td className="py-3 text-sm text-gray-600">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        {inv.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                copyToClipboard(
                                  `${window.location.origin}/sign-up?token=${inv.token}`
                                )
                              }
                              title="Copy invite link"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevoke(inv.id)}
                              title="Revoke invitation"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
