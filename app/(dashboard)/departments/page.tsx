'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DEFAULT_DEPARTMENTS } from '@/types/database';

interface Department {
  id: string;
  name: string;
  hospital_id: string;
  is_default: boolean;
  is_active: boolean;
  hospitals?: { name: string; short_code: string };
}

interface Hospital {
  id: string;
  name: string;
  short_code: string;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInitModal, setShowInitModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<string>('');
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [deptRes, hospRes] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/hospitals'),
      ]);

      const deptData = await deptRes.json();
      const hospData = await hospRes.json();

      if (deptData.success) {
        setDepartments(deptData.data || []);
      }
      if (hospData.success) {
        setHospitals(hospData.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function initializeDefaults(hospitalId: string) {
    setIsSubmitting(true);
    setError(null);
    try {
      const csrfRes = await fetch('/api/csrf');
      const { csrfToken } = await csrfRes.json();

      for (const deptName of DEFAULT_DEPARTMENTS) {
        await fetch('/api/departments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          body: JSON.stringify({
            hospital_id: hospitalId,
            name: deptName,
            is_default: true,
          }),
        });
      }

      await fetchData();
      setShowInitModal(false);
      setSelectedHospital('');
    } catch (error) {
      console.error('Error initializing departments:', error);
      setError('Failed to initialize departments');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function addDepartment() {
    if (!selectedHospital || !newDepartmentName.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const csrfRes = await fetch('/api/csrf');
      const { csrfToken } = await csrfRes.json();

      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          hospital_id: selectedHospital,
          name: newDepartmentName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add department');
      }

      await fetchData();
      setShowAddModal(false);
      setSelectedHospital('');
      setNewDepartmentName('');
    } catch (error) {
      console.error('Error adding department:', error);
      setError(error instanceof Error ? error.message : 'Failed to add department');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteDepartment(dept: Department) {
    setIsSubmitting(true);
    setError(null);
    try {
      const csrfRes = await fetch('/api/csrf');
      const { csrfToken } = await csrfRes.json();

      const res = await fetch(`/api/departments/${dept.id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete department');
      }

      await fetchData();
      setShowDeleteModal(false);
      setDepartmentToDelete(null);
    } catch (error) {
      console.error('Error deleting department:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete department');
    } finally {
      setIsSubmitting(false);
    }
  }

  function openDeleteModal(dept: Department) {
    setDepartmentToDelete(dept);
    setShowDeleteModal(true);
    setError(null);
  }

  // Group departments by hospital
  const departmentsByHospital = departments.reduce((acc, dept) => {
    const hospCode = dept.hospitals?.short_code || 'Unknown';
    if (!acc[hospCode]) {
      acc[hospCode] = {
        hospitalName: dept.hospitals?.name || 'Unknown',
        hospitalId: dept.hospital_id,
        departments: [],
      };
    }
    acc[hospCode].departments.push(dept);
    return acc;
  }, {} as Record<string, { hospitalName: string; hospitalId: string; departments: Department[] }>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-600 mt-1">
            Configure clinical departments for each hospital
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowInitModal(true)}>
            Initialize Defaults
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            Add Department
          </Button>
        </div>
      </div>

      {/* Department Info */}
      <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-4">
        <h3 className="font-medium text-indigo-900 mb-2">Default Departments</h3>
        <p className="text-sm text-indigo-700 mb-3">
          The system includes 20 default departments. Click "Initialize Defaults" to
          create them for a hospital, or "Add Department" to add individual departments.
        </p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_DEPARTMENTS.slice(0, 10).map((dept) => (
            <span
              key={dept}
              className="inline-flex items-center px-2 py-1 rounded text-xs bg-white text-indigo-700 border border-indigo-200"
            >
              {dept}
            </span>
          ))}
          <span className="text-xs text-indigo-600 self-center">
            +{DEFAULT_DEPARTMENTS.length - 10} more
          </span>
        </div>
      </div>

      {/* Departments by Hospital */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading departments...</p>
        </div>
      ) : Object.keys(departmentsByHospital).length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">🏢</div>
          <h3 className="text-lg font-medium text-gray-900">No departments yet</h3>
          <p className="text-gray-600 mt-1">
            Initialize default departments for a hospital or add individual departments
          </p>
          <div className="flex justify-center gap-2 mt-4">
            <Button variant="secondary" onClick={() => setShowInitModal(true)}>
              Initialize Defaults
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              Add Department
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(departmentsByHospital).map(([hospCode, { hospitalName, hospitalId, departments }]) => (
            <div
              key={hospCode}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {hospitalName}
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({hospCode})
                    </span>
                  </h3>
                  <p className="text-sm text-gray-500">{departments.length} departments</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSelectedHospital(hospitalId);
                    setShowAddModal(true);
                  }}
                >
                  + Add
                </Button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      className="group flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-900 truncate block">{dept.name}</span>
                        {dept.is_default && (
                          <span className="text-xs text-gray-400">Default</span>
                        )}
                      </div>
                      <button
                        onClick={() => openDeleteModal(dept)}
                        className="ml-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete department"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Initialize Defaults Modal */}
      {showInitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Initialize Default Departments
              </h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                This will create all 20 default departments for the selected hospital.
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Hospital
              </label>
              <select
                value={selectedHospital}
                onChange={(e) => setSelectedHospital(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Choose a hospital...</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.short_code})
                  </option>
                ))}
              </select>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowInitModal(false);
                  setSelectedHospital('');
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => initializeDefaults(selectedHospital)}
                disabled={!selectedHospital || isSubmitting}
              >
                {isSubmitting ? 'Initializing...' : 'Initialize'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Department Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Add New Department
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hospital
                </label>
                <select
                  value={selectedHospital}
                  onChange={(e) => setSelectedHospital(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Choose a hospital...</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.short_code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  placeholder="e.g., Neurology, Oncology"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedHospital('');
                  setNewDepartmentName('');
                  setError(null);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={addDepartment}
                disabled={!selectedHospital || !newDepartmentName.trim() || isSubmitting}
              >
                {isSubmitting ? 'Adding...' : 'Add Department'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && departmentToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Delete Department
              </h2>
            </div>
            <div className="p-6">
              {error && (
                <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
              <p className="text-gray-600">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-gray-900">{departmentToDelete.name}</span>
                {departmentToDelete.hospitals && (
                  <span> from {departmentToDelete.hospitals.name}</span>
                )}
                ?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This action will deactivate the department. Any services associated with this
                department must be removed first.
              </p>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDepartmentToDelete(null);
                  setError(null);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteDepartment(departmentToDelete)}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
