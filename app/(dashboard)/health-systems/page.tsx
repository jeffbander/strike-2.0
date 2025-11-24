'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  Loader2,
  RefreshCw,
  Search,
  MoreVertical,
  Users,
  Building,
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

interface HealthSystem {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
  _count?: {
    hospitals: number;
    admins: number;
  };
}

export default function HealthSystemsPage() {
  const [healthSystems, setHealthSystems] = useState<HealthSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Create dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealthSystems();
  }, []);

  async function fetchHealthSystems() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/health-systems');
      if (res.ok) {
        const data = await res.json();
        setHealthSystems(data.healthSystems || []);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to fetch health systems');
      }
    } catch (err) {
      setError('Failed to fetch health systems');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/health-systems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName }),
      });

      if (res.ok) {
        setIsDialogOpen(false);
        setFormName('');
        fetchHealthSystems();
      } else {
        const data = await res.json();
        setSubmitError(data.error || 'Failed to create health system');
      }
    } catch (err) {
      setSubmitError('Failed to create health system');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredSystems = healthSystems.filter((hs) =>
    hs.name.toLowerCase().includes(search.toLowerCase())
  );

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
          <h1 className="text-2xl font-bold text-gray-900">Health Systems</h1>
          <p className="text-gray-600">Manage health systems in the platform</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchHealthSystems}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Health System
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Health System</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                {submitError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                    {submitError}
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium">Name *</label>
                  <Input
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Mount Sinai Health System"
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Health System'
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search health systems..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Grid */}
      {filteredSystems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-500">
              {search ? 'No health systems found' : 'No health systems yet'}
            </p>
            {!search && (
              <p className="text-sm text-gray-400 mt-1">
                Click "Add Health System" to create your first one
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSystems.map((hs) => (
            <Card key={hs.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{hs.name}</CardTitle>
                      <p className="text-xs text-gray-500">
                        Created {new Date(hs.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      hs.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {hs.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Building className="h-4 w-4" />
                    <span>{hs._count?.hospitals || 0} hospitals</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{hs._count?.admins || 0} admins</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
