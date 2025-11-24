'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface Unit {
  id: string;
  name: string;
  floor: string | null;
  bed_count: number | null;
  is_active: boolean;
  hospitals?: { id: string; name: string; short_code: string };
}

interface Hospital {
  id: string;
  name: string;
  short_code: string;
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    hospital_id: '',
    name: '',
    floor: '',
    bed_count: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [unitsRes, hospitalsRes] = await Promise.all([
        fetch('/api/units'),
        fetch('/api/hospitals'),
      ]);

      const unitsData = await unitsRes.json();
      const hospitalsData = await hospitalsRes.json();

      if (unitsData.success) {
        setUnits(unitsData.data || []);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const csrfRes = await fetch('/api/csrf');
      const { csrfToken } = await csrfRes.json();

      const res = await fetch('/api/units', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          hospital_id: formData.hospital_id,
          name: formData.name,
          floor: formData.floor || null,
          bed_count: formData.bed_count ? parseInt(formData.bed_count) : null,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setFormData({ hospital_id: '', name: '', floor: '', bed_count: '' });
        fetchData();
      }
    } catch (error) {
      console.error('Error creating unit:', error);
    }
  }

  // Group units by hospital
  const unitsByHospital = units.reduce((acc, unit) => {
    const hospCode = unit.hospitals?.short_code || 'Unknown';
    if (!acc[hospCode]) {
      acc[hospCode] = {
        hospitalName: unit.hospitals?.name || 'Unknown',
        hospitalId: unit.hospitals?.id || '',
        units: [],
      };
    }
    acc[hospCode].units.push(unit);
    return acc;
  }, {} as Record<string, { hospitalName: string; hospitalId: string; units: Unit[] }>);

  // Group units by floor within each hospital
  function groupByFloor(hospitalUnits: Unit[]) {
    return hospitalUnits.reduce((acc, unit) => {
      const floor = unit.floor || 'Unassigned';
      if (!acc[floor]) {
        acc[floor] = [];
      }
      acc[floor].push(unit);
      return acc;
    }, {} as Record<string, Unit[]>);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Units & Floors</h1>
          <p className="text-gray-600 mt-1">
            Manage hospital units, floors, and bed capacity
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>Add Unit</Button>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <h3 className="font-medium text-blue-900 mb-2">Unit Organization</h3>
        <p className="text-sm text-blue-700">
          Units represent physical locations within hospitals (e.g., ICU, Med-Surg 4A,
          Emergency Department). You can organize units by floor and track bed capacity
          for staffing calculations.
        </p>
      </div>

      {/* Units by Hospital */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading units...</p>
        </div>
      ) : Object.keys(unitsByHospital).length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">🏗️</div>
          <h3 className="text-lg font-medium text-gray-900">No units yet</h3>
          <p className="text-gray-600 mt-1">
            Add units to organize your hospital facilities
          </p>
          <Button className="mt-4" onClick={() => setShowModal(true)}>
            Add First Unit
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(unitsByHospital).map(([hospCode, { hospitalName, units: hospitalUnits }]) => {
            const floorGroups = groupByFloor(hospitalUnits);
            const totalBeds = hospitalUnits.reduce((sum, u) => sum + (u.bed_count || 0), 0);

            return (
              <div
                key={hospCode}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {hospitalName}
                        <span className="ml-2 text-sm font-normal text-gray-500">
                          ({hospCode})
                        </span>
                      </h3>
                      <p className="text-sm text-gray-500">
                        {hospitalUnits.length} units • {Object.keys(floorGroups).length} floors • {totalBeds} beds
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-6">
                  {Object.entries(floorGroups)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([floor, floorUnits]) => (
                      <div key={floor}>
                        <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center">
                          <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center text-xs mr-2">
                            {floor === 'Unassigned' ? '?' : floor.charAt(0)}
                          </span>
                          Floor {floor}
                          <span className="ml-2 text-gray-400">
                            ({floorUnits.length} units)
                          </span>
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {floorUnits.map((unit) => (
                            <div
                              key={unit.id}
                              className="flex flex-col p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <span className="text-sm font-medium text-gray-900">
                                {unit.name}
                              </span>
                              {unit.bed_count && (
                                <span className="text-xs text-gray-500 mt-1">
                                  {unit.bed_count} beds
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Unit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add New Unit</h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hospital *
                  </label>
                  <select
                    value={formData.hospital_id}
                    onChange={(e) =>
                      setFormData({ ...formData, hospital_id: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select a hospital...</option>
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.short_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    placeholder="e.g., ICU, Med-Surg 4A, Emergency"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Floor
                    </label>
                    <input
                      type="text"
                      value={formData.floor}
                      onChange={(e) =>
                        setFormData({ ...formData, floor: e.target.value })
                      }
                      placeholder="e.g., 1, 2, B1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bed Count
                    </label>
                    <input
                      type="number"
                      value={formData.bed_count}
                      onChange={(e) =>
                        setFormData({ ...formData, bed_count: e.target.value })
                      }
                      min="0"
                      placeholder="e.g., 20"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Unit</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
