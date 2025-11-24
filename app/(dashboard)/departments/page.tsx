'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DEFAULT_DEPARTMENTS } from '@/types/database';

interface Department {
  id: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  hospitals?: { name: string; short_code: string };
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<string>('');
  const [hospitals, setHospitals] = useState<Array<{ id: string; name: string; short_code: string }>>([]);

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
    try {
      const csrfRes = await fetch('/api/csrf');
      const { csrfToken } = await csrfRes.json();

      // Create all default departments
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

      fetchData();
      setShowModal(false);
    } catch (error) {
      console.error('Error initializing departments:', error);
    }
  }

  // Group departments by hospital
  const departmentsByHospital = departments.reduce((acc, dept) => {
    const hospCode = dept.hospitals?.short_code || 'Unknown';
    if (!acc[hospCode]) {
      acc[hospCode] = {
        hospitalName: dept.hospitals?.name || 'Unknown',
        departments: [],
      };
    }
    acc[hospCode].departments.push(dept);
    return acc;
  }, {} as Record<string, { hospitalName: string; departments: Department[] }>);

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
        <Button onClick={() => setShowModal(true)}>Initialize Defaults</Button>
      </div>

      {/* Department Info */}
      <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-4">
        <h3 className="font-medium text-indigo-900 mb-2">Default Departments</h3>
        <p className="text-sm text-indigo-700 mb-3">
          The system includes 20 default departments. Click "Initialize Defaults" to
          create them for a hospital.
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
            Initialize default departments for a hospital to get started
          </p>
          <Button className="mt-4" onClick={() => setShowModal(true)}>
            Initialize Defaults
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(departmentsByHospital).map(([hospCode, { hospitalName, departments }]) => (
            <div
              key={hospCode}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  {hospitalName}
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({hospCode})
                  </span>
                </h3>
                <p className="text-sm text-gray-500">{departments.length} departments</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-900">{dept.name}</span>
                      {dept.is_default && (
                        <span className="text-xs text-gray-400">Default</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Initialize Modal */}
      {showModal && (
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
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => initializeDefaults(selectedHospital)}
                disabled={!selectedHospital}
              >
                Initialize
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
