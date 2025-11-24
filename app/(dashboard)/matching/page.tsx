'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface JobPosition {
  id: string;
  job_code: string;
  position_number: number;
  status: string;
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
    service_job_type_skills?: Array<{ skills: { name: string } }>;
  };
}

interface MatchResult {
  provider: {
    id: string;
    name: string;
    email: string;
    job_type_name: string;
    job_type_code: string;
    home_department_name: string;
    home_hospital_name: string;
    skills: string[];
    can_work_at_hospitals: string[];
  };
  matchQuality: 'Perfect' | 'Good' | 'Partial';
  score: number;
  missingSkills: string[];
  extraSkills: string[];
  reasons: string[];
}

export default function MatchingPage() {
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobPosition | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchLoading, setMatchLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('Open');
  const [filterHospital, setFilterHospital] = useState<string>('');

  useEffect(() => {
    fetchJobPositions();
  }, []);

  async function fetchJobPositions() {
    try {
      const res = await fetch('/api/job-positions');
      const data = await res.json();
      if (data.success) {
        setJobPositions(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function findMatches(job: JobPosition) {
    setSelectedJob(job);
    setMatchLoading(true);
    setMatches([]);

    try {
      const res = await fetch(`/api/matching?job_position_id=${job.id}`);
      const data = await res.json();
      if (data.success) {
        setMatches(data.matches || []);
      }
    } catch (error) {
      console.error('Error finding matches:', error);
    } finally {
      setMatchLoading(false);
    }
  }

  async function assignProvider(providerId: string) {
    if (!selectedJob) return;
    setAssigning(providerId);

    try {
      const csrfRes = await fetch('/api/csrf');
      const { csrfToken } = await csrfRes.json();

      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          job_position_id: selectedJob.id,
          provider_id: providerId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Refresh data
        fetchJobPositions();
        setSelectedJob(null);
        setMatches([]);
      } else {
        alert(data.error || 'Failed to assign provider');
      }
    } catch (error) {
      console.error('Error assigning provider:', error);
      alert('An error occurred');
    } finally {
      setAssigning(null);
    }
  }

  const filteredJobs = jobPositions.filter((job) => {
    if (filterStatus && job.status !== filterStatus) return false;
    if (
      filterHospital &&
      job.shifts?.services?.hospitals?.short_code !== filterHospital
    )
      return false;
    return true;
  });

  const openJobs = jobPositions.filter((j) => j.status === 'Open').length;
  const assignedJobs = jobPositions.filter((j) => j.status === 'Assigned').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Matching Interface</h1>
          <p className="text-gray-600 mt-1">
            Match providers to job positions based on skills and availability
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline">View Dashboard</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{jobPositions.length}</div>
          <div className="text-sm text-gray-600">Total Positions</div>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <div className="text-2xl font-bold text-red-600">{openJobs}</div>
          <div className="text-sm text-gray-600">Open</div>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-4">
          <div className="text-2xl font-bold text-green-600">{assignedJobs}</div>
          <div className="text-sm text-gray-600">Assigned</div>
        </div>
        <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-4">
          <div className="text-2xl font-bold text-indigo-600">
            {jobPositions.length > 0
              ? Math.round((assignedJobs / jobPositions.length) * 100)
              : 0}
            %
          </div>
          <div className="text-sm text-gray-600">Coverage</div>
        </div>
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Job Positions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Job Positions</h2>
            <div className="mt-3 flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
              >
                <option value="">All Status</option>
                <option value="Open">Open</option>
                <option value="Assigned">Assigned</option>
              </select>
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-600">No job positions found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredJobs.map((job) => (
                  <div
                    key={job.id}
                    className={cn(
                      'p-4 hover:bg-gray-50 cursor-pointer transition-colors',
                      selectedJob?.id === job.id && 'bg-indigo-50'
                    )}
                    onClick={() => job.status === 'Open' && findMatches(job)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{job.job_code}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {job.shifts?.services?.name} •{' '}
                          {job.shifts?.services?.hospitals?.short_code}
                        </div>
                        <div className="text-sm text-gray-500">
                          {job.shifts?.name} ({job.shifts?.start_time} -{' '}
                          {job.shifts?.end_time})
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {job.service_job_types?.service_job_type_skills?.map(
                            (s, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                              >
                                {s.skills?.name}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                          job.status === 'Open'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        )}
                      >
                        {job.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Matching Providers */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedJob ? `Matches for ${selectedJob.job_code}` : 'Select a Job'}
            </h2>
            {selectedJob && (
              <p className="text-sm text-gray-500 mt-1">
                Required:{' '}
                {selectedJob.service_job_types?.service_job_type_skills
                  ?.map((s) => s.skills?.name)
                  .join(', ') || 'None'}
              </p>
            )}
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {!selectedJob ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-4">👈</div>
                <p className="text-gray-600">
                  Select an open job position to find matching providers
                </p>
              </div>
            ) : matchLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-600 mt-4">Finding matches...</p>
              </div>
            ) : matches.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-4">😕</div>
                <p className="text-gray-600">No matching providers found</p>
                <p className="text-sm text-gray-500 mt-2">
                  Try adding more providers or adjusting skill requirements
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {matches.map((match) => (
                  <div key={match.provider.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {match.provider.name}
                          </span>
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                              match.matchQuality === 'Perfect'
                                ? 'bg-green-100 text-green-800 border-green-200'
                                : match.matchQuality === 'Good'
                                ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                : 'bg-orange-100 text-orange-800 border-orange-200'
                            )}
                          >
                            {match.matchQuality === 'Perfect' && '✅ '}
                            {match.matchQuality === 'Good' && '⚠️ '}
                            {match.matchQuality === 'Partial' && '🔶 '}
                            {match.matchQuality}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {match.provider.job_type_code} •{' '}
                          {match.provider.home_department_name} •{' '}
                          {match.provider.home_hospital_name}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {match.provider.skills.map((skill, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                        {match.missingSkills.length > 0 && (
                          <div className="text-xs text-red-600 mt-2">
                            Missing: {match.missingSkills.join(', ')}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => assignProvider(match.provider.id)}
                        loading={assigning === match.provider.id}
                        disabled={!!assigning}
                      >
                        Assign
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
