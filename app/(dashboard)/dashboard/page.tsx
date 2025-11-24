'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building,
  Layers,
  Stethoscope,
  Users,
  FileSpreadsheet,
  GitMerge,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Download,
  Plus,
} from 'lucide-react';

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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted mt-1">
            Strike Prep Capacity Management Overview
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={exportToExcel} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export Plan'}
          </Button>
          <Link href="/matching">
            <Button>
              <GitMerge className="h-4 w-4" />
              Start Matching
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-border rounded w-1/2 mb-3" />
                <div className="h-8 bg-border rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Hospitals"
            value={stats?.totalHospitals || 0}
            icon={Building}
            href="/hospitals"
            trend={stats?.totalHospitals ? '+1 this week' : undefined}
          />
          <StatCard
            title="Departments"
            value={stats?.totalDepartments || 0}
            icon={Layers}
            href="/departments"
          />
          <StatCard
            title="Services"
            value={stats?.totalServices || 0}
            icon={Stethoscope}
            href="/services"
          />
          <StatCard
            title="Providers"
            value={stats?.totalProviders || 0}
            icon={Users}
            href="/providers"
            trend={stats?.totalProviders ? 'Available for assignment' : undefined}
          />
        </div>
      )}

      {/* Coverage Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Coverage Summary</CardTitle>
              <CardDescription>Position assignment progress</CardDescription>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-primary">{assignmentRate}%</span>
              <p className="text-sm text-muted">Coverage Rate</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatusBlock
              icon={FileSpreadsheet}
              value={stats?.totalJobPositions || 0}
              label="Total Positions"
              variant="default"
            />
            <StatusBlock
              icon={AlertCircle}
              value={stats?.openPositions || 0}
              label="Open"
              variant="danger"
            />
            <StatusBlock
              icon={Clock}
              value={stats?.assignedPositions || 0}
              label="Assigned"
              variant="warning"
            />
            <StatusBlock
              icon={CheckCircle2}
              value={stats?.confirmedPositions || 0}
              label="Confirmed"
              variant="success"
            />
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Assignment Progress</span>
              <span className="font-medium text-foreground">{assignmentRate}%</span>
            </div>
            <div className="w-full bg-border rounded-full h-3 overflow-hidden">
              <div className="h-full flex">
                <div
                  className="bg-success transition-all duration-500"
                  style={{
                    width: `${stats?.totalJobPositions ? (stats.confirmedPositions / stats.totalJobPositions) * 100 : 0}%`,
                  }}
                />
                <div
                  className="bg-warning transition-all duration-500"
                  style={{
                    width: `${stats?.totalJobPositions ? (stats.assignedPositions / stats.totalJobPositions) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-4 text-xs text-muted">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-success rounded-full" />
                Confirmed
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-warning rounded-full" />
                Assigned
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-border rounded-full" />
                Open
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hospital Capacity Breakdown */}
      {hospitalCapacity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Capacity by Hospital</CardTitle>
            <CardDescription>Coverage status across facilities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {hospitalCapacity.map((hospital) => {
                const coverage =
                  hospital.total_positions > 0
                    ? Math.round((hospital.assigned / hospital.total_positions) * 100)
                    : 0;
                return (
                  <div
                    key={hospital.hospital_code}
                    className="flex items-center gap-4 p-3 rounded-lg bg-background border border-border"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary-light flex items-center justify-center flex-shrink-0">
                      <Building className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate">
                            {hospital.hospital_name}
                          </span>
                          <Badge variant="secondary">{hospital.hospital_code}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              coverage >= 80 ? 'success' : coverage >= 50 ? 'warning' : 'danger'
                            }
                          >
                            {coverage}%
                          </Badge>
                          <span className="text-sm text-muted">
                            {hospital.assigned}/{hospital.total_positions}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-border rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            coverage >= 80
                              ? 'bg-success'
                              : coverage >= 50
                                ? 'bg-warning'
                                : 'bg-danger'
                          }`}
                          style={{ width: `${coverage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks to manage your coverage plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ActionCard
              href="/hospitals"
              icon={Building}
              title="Add Hospital"
              description="Create a new hospital"
            />
            <ActionCard
              href="/services/new"
              icon={Stethoscope}
              title="Create Service"
              description="Set up staffing needs"
            />
            <ActionCard
              href="/providers"
              icon={Users}
              title="Add Providers"
              description="Manage provider roster"
            />
            <ActionCard
              href="/matching"
              icon={GitMerge}
              title="Match Providers"
              description="Fill open positions"
            />
          </div>
        </CardContent>
      </Card>

      {/* Getting Started Guide */}
      {stats?.totalJobPositions === 0 && (
        <Card className="border-primary/50 bg-primary-light/30">
          <CardHeader>
            <CardTitle className="text-primary">Getting Started</CardTitle>
            <CardDescription>
              Follow these steps to set up your strike coverage plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {[
                'Create hospitals in your health system',
                'Configure departments and units for each hospital',
                'Create services with staffing requirements',
                'Add providers with their skills and hospital access',
                'Use the matching interface to assign providers to jobs',
                'Export your coverage plan',
              ].map((step, index) => (
                <li key={index} className="flex items-center gap-3">
                  <span className="h-6 w-6 rounded-full bg-primary text-white text-sm font-medium flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  trend,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  trend?: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted">{title}</p>
              <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
              {trend && (
                <p className="text-xs text-muted mt-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-success" />
                  {trend}
                </p>
              )}
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary-light flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function StatusBlock({
  icon: Icon,
  value,
  label,
  variant,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  variant: 'default' | 'success' | 'warning' | 'danger';
}) {
  const bgColors = {
    default: 'bg-background',
    success: 'bg-success-light',
    warning: 'bg-warning-light',
    danger: 'bg-danger-light',
  };

  const textColors = {
    default: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  };

  const iconColors = {
    default: 'text-muted',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  };

  return (
    <div className={`p-4 rounded-lg ${bgColors[variant]} text-center`}>
      <Icon className={`h-5 w-5 mx-auto mb-2 ${iconColors[variant]}`} />
      <div className={`text-2xl font-bold ${textColors[variant]}`}>{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

function ActionCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <div className="p-4 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-primary-light/30 transition-all cursor-pointer group">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary-light flex items-center justify-center group-hover:bg-primary transition-colors">
            <Icon className="h-4 w-4 text-primary group-hover:text-white transition-colors" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
              {title}
            </h3>
            <p className="text-sm text-muted">{description}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </Link>
  );
}
