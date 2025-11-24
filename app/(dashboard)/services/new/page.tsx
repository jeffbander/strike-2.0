'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

// Types
interface Hospital {
  id: string;
  name: string;
  short_code: string;
}

interface Department {
  id: string;
  name: string;
  hospital_id: string;
}

interface Unit {
  id: string;
  name: string;
  hospital_id: string;
}

interface JobType {
  id: string;
  name: string;
  code: string;
}

interface Skill {
  id: string;
  name: string;
  category: string;
}

interface ShiftConfig {
  name: string;
  shift_type: 'Day' | 'Night' | 'Swing';
  start_time: string;
  end_time: string;
  positions_needed: number;
}

interface ServiceJobTypeConfig {
  job_type_id: string;
  positions_per_shift: number;
  skills: string[];
}

const STEPS = [
  { id: 1, name: 'Basic Info', description: 'Service name and location' },
  { id: 2, name: 'Operations', description: 'Hours and capacity' },
  { id: 3, name: 'Job Types', description: 'Required positions' },
  { id: 4, name: 'Shifts', description: 'Shift schedules' },
  { id: 5, name: 'Review', description: 'Confirm and create' },
];

const DEFAULT_SHIFTS: ShiftConfig[] = [
  { name: 'Day Shift', shift_type: 'Day', start_time: '07:00', end_time: '19:00', positions_needed: 1 },
  { name: 'Night Shift', shift_type: 'Night', start_time: '19:00', end_time: '07:00', positions_needed: 1 },
];

export default function NewServicePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference data
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    name: '',
    hospital_id: '',
    department_id: '',
    unit_id: '',
    // Step 2: Operations
    operates_days: true,
    operates_nights: true,
    operates_weekends: false,
    day_capacity: '',
    night_capacity: '',
    weekend_capacity: '',
  });

  // Step 3: Job Types with skills
  const [serviceJobTypes, setServiceJobTypes] = useState<ServiceJobTypeConfig[]>([]);

  // Step 4: Shifts
  const [shifts, setShifts] = useState<ShiftConfig[]>(DEFAULT_SHIFTS);

  // Load reference data
  useEffect(() => {
    async function loadData() {
      try {
        const [hospRes, deptRes, unitRes, jobTypeRes, skillRes] = await Promise.all([
          fetch('/api/hospitals'),
          fetch('/api/departments'),
          fetch('/api/units'),
          fetch('/api/job-types'),
          fetch('/api/skills'),
        ]);

        const [hospData, deptData, unitData, jobTypeData, skillData] = await Promise.all([
          hospRes.json(),
          deptRes.json(),
          unitRes.json(),
          jobTypeRes.json(),
          skillRes.json(),
        ]);

        if (hospData.success) setHospitals(hospData.data || []);
        if (deptData.success) setDepartments(deptData.data || []);
        if (unitData.success) setUnits(unitData.data || []);
        if (jobTypeData.success) setJobTypes(jobTypeData.data || []);
        if (skillData.success) setSkills(skillData.data || []);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load form data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter departments and units by selected hospital
  const filteredDepartments = departments.filter(
    (d) => d.hospital_id === formData.hospital_id
  );
  const filteredUnits = units.filter(
    (u) => u.hospital_id === formData.hospital_id
  );

  // Group skills by category
  const skillsByCategory = skills.reduce((acc, skill) => {
    if (!acc[skill.category]) acc[skill.category] = [];
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  // Validation
  function canProceed(): boolean {
    switch (currentStep) {
      case 1:
        return !!(formData.name && formData.hospital_id && formData.department_id);
      case 2:
        return formData.operates_days || formData.operates_nights || formData.operates_weekends;
      case 3:
        return serviceJobTypes.length > 0;
      case 4:
        return shifts.length > 0 && shifts.every((s) => s.name && s.positions_needed > 0);
      default:
        return true;
    }
  }

  // Add job type
  function addJobType(jobTypeId: string) {
    if (serviceJobTypes.find((jt) => jt.job_type_id === jobTypeId)) return;
    setServiceJobTypes([
      ...serviceJobTypes,
      { job_type_id: jobTypeId, positions_per_shift: 1, skills: [] },
    ]);
  }

  // Remove job type
  function removeJobType(jobTypeId: string) {
    setServiceJobTypes(serviceJobTypes.filter((jt) => jt.job_type_id !== jobTypeId));
  }

  // Toggle skill for job type
  function toggleSkill(jobTypeId: string, skillId: string) {
    setServiceJobTypes(
      serviceJobTypes.map((jt) => {
        if (jt.job_type_id !== jobTypeId) return jt;
        const hasSkill = jt.skills.includes(skillId);
        return {
          ...jt,
          skills: hasSkill
            ? jt.skills.filter((s) => s !== skillId)
            : [...jt.skills, skillId],
        };
      })
    );
  }

  // Update positions for job type
  function updateJobTypePositions(jobTypeId: string, positions: number) {
    setServiceJobTypes(
      serviceJobTypes.map((jt) =>
        jt.job_type_id === jobTypeId ? { ...jt, positions_per_shift: positions } : jt
      )
    );
  }

  // Add shift
  function addShift() {
    setShifts([
      ...shifts,
      {
        name: `Shift ${shifts.length + 1}`,
        shift_type: 'Day',
        start_time: '07:00',
        end_time: '19:00',
        positions_needed: 1,
      },
    ]);
  }

  // Remove shift
  function removeShift(index: number) {
    setShifts(shifts.filter((_, i) => i !== index));
  }

  // Update shift
  function updateShift(index: number, updates: Partial<ShiftConfig>) {
    setShifts(shifts.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  }

  // Submit
  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      const csrfRes = await fetch('/api/csrf');
      const { csrfToken } = await csrfRes.json();

      const payload = {
        name: formData.name,
        hospital_id: formData.hospital_id,
        department_id: formData.department_id,
        unit_id: formData.unit_id || null,
        operates_days: formData.operates_days,
        operates_nights: formData.operates_nights,
        operates_weekends: formData.operates_weekends,
        day_capacity: formData.day_capacity ? parseInt(formData.day_capacity) : null,
        night_capacity: formData.night_capacity ? parseInt(formData.night_capacity) : null,
        weekend_capacity: formData.weekend_capacity ? parseInt(formData.weekend_capacity) : null,
        job_types: serviceJobTypes,
        shifts: shifts,
      };

      const res = await fetch('/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        router.push('/services');
      } else {
        setError(data.error || 'Failed to create service');
      }
    } catch (err) {
      console.error('Error creating service:', err);
      setError('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create New Service</h1>
        <p className="text-gray-600 mt-1">
          Define staffing requirements, job types, and shift schedules
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <nav className="flex items-center justify-between">
          {STEPS.map((step, idx) => (
            <div
              key={step.id}
              className={`flex items-center ${idx < STEPS.length - 1 ? 'flex-1' : ''}`}
            >
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                    currentStep > step.id
                      ? 'bg-indigo-600 text-white'
                      : currentStep === step.id
                      ? 'bg-indigo-100 text-indigo-600 border-2 border-indigo-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {currentStep > step.id ? '✓' : step.id}
                </div>
                <div className="mt-2 text-center hidden sm:block">
                  <div
                    className={`text-sm font-medium ${
                      currentStep >= step.id ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {step.name}
                  </div>
                  <div className="text-xs text-gray-500">{step.description}</div>
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-4 ${
                    currentStep > step.id ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Adult ICU Nursing"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hospital *
                </label>
                <select
                  value={formData.hospital_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hospital_id: e.target.value,
                      department_id: '',
                      unit_id: '',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Select hospital...</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.short_code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department *
                </label>
                <select
                  value={formData.department_id}
                  onChange={(e) =>
                    setFormData({ ...formData, department_id: e.target.value })
                  }
                  disabled={!formData.hospital_id}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                >
                  <option value="">Select department...</option>
                  {filteredDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit (Optional)
                </label>
                <select
                  value={formData.unit_id}
                  onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                  disabled={!formData.hospital_id}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                >
                  <option value="">No specific unit</option>
                  {filteredUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Operations */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">Hours of Operation</h2>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.operates_days}
                    onChange={(e) =>
                      setFormData({ ...formData, operates_days: e.target.checked })
                    }
                    className="h-4 w-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Day Shifts (7am - 7pm)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.operates_nights}
                    onChange={(e) =>
                      setFormData({ ...formData, operates_nights: e.target.checked })
                    }
                    className="h-4 w-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Night Shifts (7pm - 7am)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.operates_weekends}
                    onChange={(e) =>
                      setFormData({ ...formData, operates_weekends: e.target.checked })
                    }
                    className="h-4 w-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Weekend Coverage</span>
                </label>
              </div>
            </div>

            <h2 className="text-lg font-medium text-gray-900 pt-4">Patient Capacity</h2>
            <p className="text-sm text-gray-500">
              Optional: Define typical patient volumes for staffing calculations
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Day Capacity
                </label>
                <input
                  type="number"
                  value={formData.day_capacity}
                  onChange={(e) =>
                    setFormData({ ...formData, day_capacity: e.target.value })
                  }
                  min="0"
                  placeholder="e.g., 20"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Night Capacity
                </label>
                <input
                  type="number"
                  value={formData.night_capacity}
                  onChange={(e) =>
                    setFormData({ ...formData, night_capacity: e.target.value })
                  }
                  min="0"
                  placeholder="e.g., 15"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weekend Capacity
                </label>
                <input
                  type="number"
                  value={formData.weekend_capacity}
                  onChange={(e) =>
                    setFormData({ ...formData, weekend_capacity: e.target.value })
                  }
                  min="0"
                  placeholder="e.g., 12"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Job Types */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Job Types</h2>
                <p className="text-sm text-gray-500">
                  Select the types of positions needed and their required skills
                </p>
              </div>
            </div>

            {/* Available Job Types */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Available Job Types</h3>
              <div className="flex flex-wrap gap-2">
                {jobTypes.map((jt) => {
                  const isSelected = serviceJobTypes.some((s) => s.job_type_id === jt.id);
                  return (
                    <button
                      key={jt.id}
                      onClick={() => (isSelected ? removeJobType(jt.id) : addJobType(jt.id))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:border-indigo-300'
                      }`}
                    >
                      {jt.name} ({jt.code})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Job Types with Skills */}
            {serviceJobTypes.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700">
                  Selected Job Types ({serviceJobTypes.length})
                </h3>
                {serviceJobTypes.map((sjt) => {
                  const jobType = jobTypes.find((jt) => jt.id === sjt.job_type_id);
                  return (
                    <div
                      key={sjt.job_type_id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg font-medium text-gray-900">
                            {jobType?.name}
                          </span>
                          <span className="text-sm text-gray-500">({jobType?.code})</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <label className="text-sm text-gray-600">Positions per shift:</label>
                          <input
                            type="number"
                            value={sjt.positions_per_shift}
                            onChange={(e) =>
                              updateJobTypePositions(sjt.job_type_id, parseInt(e.target.value) || 1)
                            }
                            min="1"
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                          />
                          <button
                            onClick={() => removeJobType(sjt.job_type_id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Skills Selection */}
                      <div className="space-y-3">
                        <div className="text-sm font-medium text-gray-600">Required Skills:</div>
                        {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                          <div key={category}>
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                              {category}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {categorySkills.map((skill) => {
                                const isSelected = sjt.skills.includes(skill.id);
                                return (
                                  <button
                                    key={skill.id}
                                    onClick={() => toggleSkill(sjt.job_type_id, skill.id)}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                      isSelected
                                        ? 'bg-green-100 text-green-800 border border-green-300'
                                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:border-gray-300'
                                    }`}
                                  >
                                    {skill.name}
                                    {isSelected && ' ✓'}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {serviceJobTypes.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Select at least one job type to continue
              </div>
            )}
          </div>
        )}

        {/* Step 4: Shifts */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Shift Configuration</h2>
                <p className="text-sm text-gray-500">
                  Define the shifts for this service. Job positions will be auto-generated.
                </p>
              </div>
              <Button variant="secondary" onClick={addShift}>
                Add Shift
              </Button>
            </div>

            <div className="space-y-4">
              {shifts.map((shift, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Shift Name
                      </label>
                      <input
                        type="text"
                        value={shift.name}
                        onChange={(e) => updateShift(index, { name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Type
                      </label>
                      <select
                        value={shift.shift_type}
                        onChange={(e) =>
                          updateShift(index, {
                            shift_type: e.target.value as 'Day' | 'Night' | 'Swing',
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="Day">Day</option>
                        <option value="Night">Night</option>
                        <option value="Swing">Swing</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={shift.start_time}
                        onChange={(e) => updateShift(index, { start_time: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={shift.end_time}
                        onChange={(e) => updateShift(index, { end_time: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex items-end space-x-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Positions
                        </label>
                        <input
                          type="number"
                          value={shift.positions_needed}
                          onChange={(e) =>
                            updateShift(index, {
                              positions_needed: parseInt(e.target.value) || 1,
                            })
                          }
                          min="1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      {shifts.length > 1 && (
                        <button
                          onClick={() => removeShift(index)}
                          className="p-2 text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Job Positions Preview */}
            <div className="bg-indigo-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-indigo-900 mb-2">
                Job Positions Preview
              </h3>
              <p className="text-sm text-indigo-700">
                Based on your configuration, the following job positions will be created:
              </p>
              <div className="mt-3 text-sm text-indigo-800">
                <strong>
                  {shifts.reduce((sum, s) => sum + s.positions_needed, 0) *
                    serviceJobTypes.reduce((sum, jt) => sum + jt.positions_per_shift, 0)}{' '}
                  total positions
                </strong>{' '}
                ({shifts.length} shifts × {serviceJobTypes.length} job types)
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">Review & Confirm</h2>

            {/* Basic Info Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Basic Information</h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Service Name</dt>
                  <dd className="font-medium text-gray-900">{formData.name}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Hospital</dt>
                  <dd className="font-medium text-gray-900">
                    {hospitals.find((h) => h.id === formData.hospital_id)?.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Department</dt>
                  <dd className="font-medium text-gray-900">
                    {departments.find((d) => d.id === formData.department_id)?.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Unit</dt>
                  <dd className="font-medium text-gray-900">
                    {formData.unit_id
                      ? units.find((u) => u.id === formData.unit_id)?.name
                      : 'None specified'}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Operations Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Operations</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.operates_days && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                    Day Shifts
                  </span>
                )}
                {formData.operates_nights && (
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs">
                    Night Shifts
                  </span>
                )}
                {formData.operates_weekends && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                    Weekend Coverage
                  </span>
                )}
              </div>
              {(formData.day_capacity || formData.night_capacity || formData.weekend_capacity) && (
                <div className="text-sm text-gray-600">
                  Capacity: Day {formData.day_capacity || '-'} / Night{' '}
                  {formData.night_capacity || '-'} / Weekend {formData.weekend_capacity || '-'}
                </div>
              )}
            </div>

            {/* Job Types Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Job Types ({serviceJobTypes.length})
              </h3>
              <div className="space-y-2">
                {serviceJobTypes.map((sjt) => {
                  const jobType = jobTypes.find((jt) => jt.id === sjt.job_type_id);
                  return (
                    <div key={sjt.job_type_id} className="flex justify-between items-center text-sm">
                      <span className="font-medium text-gray-900">{jobType?.name}</span>
                      <span className="text-gray-500">
                        {sjt.positions_per_shift} per shift, {sjt.skills.length} skills required
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Shifts Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Shifts ({shifts.length})</h3>
              <div className="space-y-2">
                {shifts.map((shift, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-900">{shift.name}</span>
                    <span className="text-gray-500">
                      {shift.start_time} - {shift.end_time} ({shift.shift_type}), {shift.positions_needed} positions
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Positions */}
            <div className="bg-indigo-600 rounded-lg p-4 text-white">
              <div className="text-center">
                <div className="text-3xl font-bold">
                  {shifts.reduce((sum, s) => sum + s.positions_needed, 0) *
                    serviceJobTypes.reduce((sum, jt) => sum + jt.positions_per_shift, 0)}
                </div>
                <div className="text-indigo-200">Total Job Positions to Create</div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 mt-6 border-t border-gray-200">
          <Button
            variant="secondary"
            onClick={() => (currentStep === 1 ? router.push('/services') : setCurrentStep(currentStep - 1))}
          >
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>
          {currentStep < 5 ? (
            <Button onClick={() => setCurrentStep(currentStep + 1)} disabled={!canProceed()}>
              Continue
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Service'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
