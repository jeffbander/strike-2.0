'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Building2, Plus, Pencil, Search } from 'lucide-react';

interface HealthSystem {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  created_by: string;
}

export default function HealthSystemsPage() {
  const [healthSystems, setHealthSystems] = useState<HealthSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchHealthSystems();
  }, []);

  async function fetchHealthSystems() {
    try {
      const res = await fetch('/api/health-systems');
      const data = await res.json();
      if (data.success) {
        setHealthSystems(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching health systems:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const csrfRes = await fetch('/api/csrf');
      const { csrfToken } = await csrfRes.json();

      const res = await fetch('/api/health-systems', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        setShowModal(false);
        setFormData({ name: '' });
        fetchHealthSystems();
      } else {
        setError(data.error || 'Failed to create health system');
      }
    } catch (error) {
      setError('An error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredSystems = healthSystems.filter((system) =>
    system.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Health Systems</h1>
          <p className="text-muted mt-1">
            Manage health systems and their hierarchies
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4" />
          Add Health System
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <Input
          placeholder="Search health systems..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Health Systems Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-border rounded w-3/4 mb-3" />
                <div className="h-3 bg-border rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredSystems.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="h-12 w-12 rounded-lg bg-primary-light flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground">
              {searchTerm ? 'No health systems found' : 'No health systems yet'}
            </h3>
            <p className="text-muted mt-1">
              {searchTerm
                ? 'Try adjusting your search'
                : 'Get started by adding your first health system'}
            </p>
            {!searchTerm && (
              <Button className="mt-4" onClick={() => setShowModal(true)}>
                <Plus className="h-4 w-4" />
                Add Health System
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSystems.map((system) => (
            <Card
              key={system.id}
              className="hover:border-primary/50 hover:shadow-md transition-all"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary-light flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{system.name}</h3>
                      <p className="text-sm text-muted">
                        Created {new Date(system.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={system.is_active ? 'success' : 'secondary'}>
                    {system.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="mt-4 pt-4 border-t border-border flex justify-end">
                  <Button variant="ghost" size="sm">
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Health System Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Health System</DialogTitle>
            <DialogDescription>
              Create a new health system to organize hospitals and departments.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {error && (
                <div className="p-3 bg-danger-light border border-danger/20 rounded-lg text-danger text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Health System Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Kaiser Permanente"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Add Health System
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
