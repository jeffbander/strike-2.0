'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Scenario {
  id: string;
  name: string;
  description?: string;
  hospital_id: string;
  department_id?: string;
  created_at: string;
  last_modified_at: string;
  hospitals?: { name: string; short_code: string };
  departments?: { name: string };
  // Calculated fields from service configs
  service_count?: number;
  enabled_service_count?: number;
  total_original_positions?: number;
  total_adjusted_positions?: number;
}

interface Service {
  id: string;
  name: string;
  operates_days: boolean;
  operates_nights: boolean;
  operates_weekends: boolean;
  day_capacity?: number;
  night_capacity?: number;
  weekend_capacity?: number;
  departments?: { name: string };
  hospitals?: { name: string; short_code: string };
}

interface Hospital {
  id: string;
  name: string;
  short_code: string;
}

export default function ModelingPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state for new scenario
  const [newScenario, setNewScenario] = useState({
    name: '',
    description: '',
    hospital_id: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [scenariosRes, servicesRes, hospitalsRes] = await Promise.all([
        fetch('/api/modeling/scenarios'),
        fetch('/api/services'),
        fetch('/api/hospitals'),
      ]);

      const [scenariosData, servicesData, hospitalsData] = await Promise.all([
        scenariosRes.json(),
        servicesRes.json(),
        hospitalsRes.json(),
      ]);

      if (scenariosData.success) {
        setScenarios(scenariosData.data || []);
      }
      if (servicesData.success) {
        setServices(servicesData.data || []);
      }
      if (hospitalsData.success) {
        setHospitals(hospitalsData.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createScenario(e: React.FormEvent) {
    e.preventDefault();
    if (!newScenario.name || !newScenario.hospital_id) return;

    setCreating(true);
    try {
      const csrfRes = await fetch('/api/csrf');
      const { csrfToken } = await csrfRes.json();

      const res = await fetch('/api/modeling/scenarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(newScenario),
      });

      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setNewScenario({ name: '', description: '', hospital_id: '' });
        fetchData();
      } else {
        alert(data.error || 'Failed to create scenario');
      }
    } catch (error) {
      console.error('Error creating scenario:', error);
      alert('An error occurred');
    } finally {
      setCreating(false);
    }
  }

  async function deleteScenario(id: string) {
    if (!confirm('Are you sure you want to delete this scenario?')) return;

    try {
      const csrfRes = await fetch('/api/csrf');
      const { csrfToken } = await csrfRes.json();

      const res = await fetch(`/api/modeling/scenarios/${id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });

      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Failed to delete scenario');
      }
    } catch (error) {
      console.error('Error deleting scenario:', error);
      alert('An error occurred');
    }
  }

  // Calculate staffing reduction percentage
  const getStaffingChange = (scenario: Scenario) => {
    if (!scenario.total_original_positions || !scenario.total_adjusted_positions) {
      return null;
    }
    const change =
      ((scenario.total_adjusted_positions - scenario.total_original_positions) /
        scenario.total_original_positions) *
      100;
    return change;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staffing Modeling</h1>
          <p className="text-gray-600 mt-1">
            Create scenarios to model staffing needs at different service levels
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>New Scenario</Button>
      </div>

      {/* Info Card */}
      <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-6">
        <h2 className="text-lg font-semibold text-indigo-900 mb-2">
          What is Staffing Modeling?
        </h2>
        <p className="text-indigo-700">
          Model different staffing scenarios by adjusting service levels, volumes, and
          operating hours. See how staffing needs change when you operate at 50%, turn
          off night shifts, or reduce weekend coverage. Compare scenarios side-by-side
          to plan for different contingencies.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{scenarios.length}</div>
          <div className="text-sm text-gray-600">Total Scenarios</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{services.length}</div>
          <div className="text-sm text-gray-600">Available Services</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{hospitals.length}</div>
          <div className="text-sm text-gray-600">Hospitals</div>
        </div>
        <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-4">
          <div className="text-2xl font-bold text-indigo-600">
            {scenarios.length > 0 ? 'Ready' : 'Start'}
          </div>
          <div className="text-sm text-gray-600">
            {scenarios.length > 0 ? 'Compare scenarios' : 'Create first scenario'}
          </div>
        </div>
      </div>

      {/* Scenarios Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse"
            >
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : scenarios.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900">No scenarios yet</h3>
          <p className="text-gray-600 mt-1">
            Create your first scenario to start modeling staffing needs
          </p>
          <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
            Create Scenario
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenarios.map((scenario) => {
            const staffingChange = getStaffingChange(scenario);
            return (
              <div
                key={scenario.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {scenario.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {scenario.hospitals?.name || 'All Hospitals'}
                      {scenario.departments && ` • ${scenario.departments.name}`}
                    </p>
                  </div>
                  <span className="text-2xl ml-2">📊</span>
                </div>

                {scenario.description && (
                  <p className="text-sm text-gray-600 mt-3 line-clamp-2">
                    {scenario.description}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded p-2 text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {scenario.enabled_service_count ?? '-'}/
                      {scenario.service_count ?? '-'}
                    </div>
                    <div className="text-xs text-gray-500">Services Active</div>
                  </div>
                  <div
                    className={cn(
                      'rounded p-2 text-center',
                      staffingChange !== null
                        ? staffingChange < 0
                          ? 'bg-green-50'
                          : staffingChange > 0
                          ? 'bg-red-50'
                          : 'bg-gray-50'
                        : 'bg-gray-50'
                    )}
                  >
                    <div
                      className={cn(
                        'text-lg font-semibold',
                        staffingChange !== null
                          ? staffingChange < 0
                            ? 'text-green-600'
                            : staffingChange > 0
                            ? 'text-red-600'
                            : 'text-gray-900'
                          : 'text-gray-900'
                      )}
                    >
                      {staffingChange !== null
                        ? `${staffingChange > 0 ? '+' : ''}${staffingChange.toFixed(0)}%`
                        : '-'}
                    </div>
                    <div className="text-xs text-gray-500">Staff Change</div>
                  </div>
                </div>

                {(scenario.total_original_positions || scenario.total_adjusted_positions) && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Original:</span>
                      <span className="font-medium">
                        {scenario.total_original_positions} positions
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-500">Adjusted:</span>
                      <span className="font-medium">
                        {scenario.total_adjusted_positions} positions
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                  <button
                    onClick={() => deleteScenario(scenario.id)}
                    className="text-sm text-red-600 hover:text-red-900 font-medium"
                  >
                    Delete
                  </button>
                  <Link href={`/modeling/${scenario.id}`}>
                    <button className="text-sm text-indigo-600 hover:text-indigo-900 font-medium">
                      Configure →
                    </button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Create New Scenario
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Start modeling staffing for different situations
              </p>
            </div>
            <form onSubmit={createScenario}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Scenario Name *
                  </label>
                  <input
                    type="text"
                    value={newScenario.name}
                    onChange={(e) =>
                      setNewScenario({ ...newScenario, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., 50% Capacity Plan"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hospital *
                  </label>
                  <select
                    value={newScenario.hospital_id}
                    onChange={(e) =>
                      setNewScenario({ ...newScenario, hospital_id: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                    <option value="">Select a hospital</option>
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.short_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newScenario.description}
                    onChange={(e) =>
                      setNewScenario({ ...newScenario, description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Describe what this scenario models..."
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={creating} disabled={creating}>
                  Create Scenario
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
