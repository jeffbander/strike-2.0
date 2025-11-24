'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface DashboardStats {
  totalHospitals: number;
  totalDepartments: number;
  totalServices: number;
  totalProviders: number;
  totalJobPositions: number;
  assignedPositions: number;
  openPositions: number;
  confirmedPositions: number;
}

interface HospitalCapacity {
  hospital_code: string;
  hospital_name: string;
  total_positions: number;
  assigned: number;
  open: number;
}

interface JobPosition {
  id: string;
  job_code: string;
  status: string;
  providers?: { name: string; email: string } | null;
  shifts?: {
    name: string;
    shift_type: string;
    start_time: string;
    end_time: string;
    services?: {
      name: string;
      departments?: { name: string };
      hospitals?: { name: string; short_code: string };
    };
  };
  service_job_types?: {
    job_types?: { name: string; code: string };
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [hospitalCapacity, setHospitalCapacity] = useState<HospitalCapacity[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      const [hospitalsRes, deptRes, servicesRes, providersRes, jobsRes] = await Promise.all([
        fetch('/api/hospitals'),
        fetch('/api/departments'),
        fetch('/api/services'),
        fetch('/api/providers'),
        fetch('/api/job-positions'),
      ]);

      const [hospitalsData, deptData, servicesData, providersData, jobsData] = await Promise.all([
        hospitalsRes.json(),
        deptRes.json(),
        servicesRes.json(),
        providersRes.json(),
        jobsRes.json(),
      ]);

      const hospitals = hospitalsData.data || [];
      const departments = deptData.data || [];
      const services = servicesData.data || [];
      const providers = providersData.data || [];
      const jobs: JobPosition[] = jobsData.data || [];

      setJobPositions(jobs);

      // Calculate stats
      const openPositions = jobs.filter((j) => j.status === 'Open').length;
      const assignedPositions = jobs.filter((j) => j.status === 'Assigned').length;
      const confirmedPositions = jobs.filter((j) => j.status === 'Confirmed').length;

      setStats({
        totalHospitals: hospitals.length,
        totalDepartments: departments.length,
        totalServices: services.length,
        totalProviders: providers.length,
        totalJobPositions: jobs.length,
        assignedPositions,
        openPositions,
        confirmedPositions,
      });

      // Calculate capacity by hospital
      const capacityMap: Record<string, HospitalCapacity> = {};
      jobs.forEach((job) => {
        const code = job.shifts?.services?.hospitals?.short_code || 'Unknown';
        const name = job.shifts?.services?.hospitals?.name || 'Unknown';
        if (!capacityMap[code]) {
          capacityMap[code] = {
            hospital_code: code,
            hospital_name: name,
            total_positions: 0,
            assigned: 0,
            open: 0,
          };
        }
        capacityMap[code].total_positions++;
        if (job.status === 'Open') {
          capacityMap[code].open++;
        } else {
          capacityMap[code].assigned++;
        }
      });
      setHospitalCapacity(Object.values(capacityMap));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  function exportToExcel() {
    setExporting(true);

    try {
      // Build CSV content
      const headers = [
        'Job Code',
        'Hospital',
        'Service',
        'Department',
        'Shift',
        'Shift Type',
        'Start Time',
        'End Time',
        'Job Type',
        'Status',
        'Assigned Provider',
        'Provider Email',
      ];

      const rows = jobPositions.map((job) => [
        job.job_code,
        job.shifts?.services?.hospitals?.short_code || '',
        job.shifts?.services?.name || '',
        job.shifts?.services?.departments?.name || '',
        job.shifts?.name || '',
        job.shifts?.shift_type || '',
        job.shifts?.start_time || '',
        job.shifts?.end_time || '',
        job.service_job_types?.job_types?.code || '',
        job.status,
        job.providers?.name || '',
        job.providers?.email || '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `coverage-plan-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export coverage plan');
    } finally {
      setExporting(false);
    }
  }

  const assignmentRate =
    stats && stats.totalJobPositions > 0
      ? Math.round(((stats.assignedPositions + stats.confirmedPositions) / stats.totalJobPositions) * 100)
      : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Strike Prep Capacity Management Overview
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={exportToExcel} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export Coverage Plan'}
          </Button>
          <Link href="/matching">
            <Button>Start Matching</Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Hospitals"
            value={stats?.totalHospitals || 0}
            icon="🏥"
            href="/hospitals"
          />
          <StatCard
            title="Departments"
            value={stats?.totalDepartments || 0}
            icon="🏢"
            href="/departments"
          />
          <StatCard
            title="Services"
            value={stats?.totalServices || 0}
            icon="⚕️"
            href="/services"
          />
          <StatCard
            title="Providers"
            value={stats?.totalProviders || 0}
            icon="👩‍⚕️"
            href="/providers"
          />
        </div>
      )}

      {/* Capacity Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Capacity Summary</h2>
          <span className="text-2xl font-bold text-indigo-600">{assignmentRate}% Coverage</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-gray-900">
              {stats?.totalJobPositions || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Total Positions</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-3xl font-bold text-red-600">
              {stats?.openPositions || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Open</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-3xl font-bold text-yellow-600">
              {stats?.assignedPositions || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Assigned</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">
              {stats?.confirmedPositions || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Confirmed</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Assignment Progress</span>
            <span className="font-medium text-gray-900">{assignmentRate}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div className="h-full flex">
              <div
                className="bg-green-500 transition-all duration-500"
                style={{ width: `${stats?.totalJobPositions ? (stats.confirmedPositions / stats.totalJobPositions) * 100 : 0}%` }}
              />
              <div
                className="bg-yellow-500 transition-all duration-500"
                style={{ width: `${stats?.totalJobPositions ? (stats.assignedPositions / stats.totalJobPositions) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-4 mt-2 text-xs">
            <span className="flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded mr-1"></span>
              Confirmed
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 bg-yellow-500 rounded mr-1"></span>
              Assigned
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 bg-gray-200 rounded mr-1"></span>
              Open
            </span>
          </div>
        </div>
      </div>

      {/* Hospital Capacity Breakdown */}
      {hospitalCapacity.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Capacity by Hospital</h2>
          <div className="space-y-4">
            {hospitalCapacity.map((hospital) => {
              const coverage = hospital.total_positions > 0
                ? Math.round((hospital.assigned / hospital.total_positions) * 100)
                : 0;
              return (
                <div key={hospital.hospital_code} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <span className="font-medium text-gray-900">{hospital.hospital_name}</span>
                      <span className="text-gray-500 ml-2">({hospital.hospital_code})</span>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold ${coverage >= 80 ? 'text-green-600' : coverage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {coverage}%
                      </span>
                      <span className="text-gray-500 text-sm ml-2">
                        ({hospital.assigned}/{hospital.total_positions})
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        coverage >= 80 ? 'bg-green-500' : coverage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${coverage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link href="/hospitals">
            <ActionCard
              title="Add Hospital"
              description="Create a new hospital"
              icon="🏥"
            />
          </Link>
          <Link href="/services/new">
            <ActionCard
              title="Create Service"
              description="Set up staffing needs"
              icon="⚕️"
            />
          </Link>
          <Link href="/providers">
            <ActionCard
              title="Add Providers"
              description="Manage provider roster"
              icon="👩‍⚕️"
            />
          </Link>
          <Link href="/matching">
            <ActionCard
              title="Match Providers"
              description="Fill open positions"
              icon="🔄"
            />
          </Link>
        </div>
      </div>

      {/* Setup Guide for new users */}
      {stats?.totalJobPositions === 0 && (
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-6">
          <h2 className="text-lg font-semibold text-indigo-900 mb-2">Getting Started</h2>
          <p className="text-indigo-700 mb-4">
            Follow these steps to set up your strike coverage plan:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-indigo-800">
            <li>Create hospitals in your health system</li>
            <li>Configure departments and units for each hospital</li>
            <li>Create services with staffing requirements</li>
            <li>Add providers with their skills and hospital access</li>
            <li>Use the matching interface to assign providers to jobs</li>
            <li>Export your coverage plan</li>
          </ol>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  href,
}: {
  title: string;
  value: number;
  icon: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
          <div className="text-3xl">{icon}</div>
        </div>
      </div>
    </Link>
  );
}

function ActionCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all cursor-pointer">
      <div className="flex items-start space-x-3">
        <div className="text-2xl">{icon}</div>
        <div>
          <h3 className="font-medium text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </div>
  );
}
