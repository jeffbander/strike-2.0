'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface Provider {
  id: string;
  name: string;
  email: string;
  phone?: string;
  departments?: { name: string };
  hospitals?: { name: string; short_code: string };
  job_types?: { id: string; name: string; code: string };
  provider_skills?: Array<{ skills: { id: string; name: string; category: string } }>;
  provider_hospital_access?: Array<{ hospitals: { id: string; short_code: string } }>;
  assignments?: Array<{ status: string; job_positions?: { job_code: string } }>;
}

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

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    job_type_id: '',
    home_hospital_id: '',
    home_department_id: '',
    selectedSkills: [] as string[],
    hospitalAccess: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [provRes, hospRes, deptRes, jobTypeRes, skillRes] = await Promise.all([
        fetch('/api/providers?include_assigned=true'),
        fetch('/api/hospitals'),
        fetch('/api/departments'),
        fetch('/api/job-types'),
        fetch('/api/skills'),
      ]);

      const [provData, hospData, deptData, jobTypeData, skillData] = await Promise.all([
        provRes.json(),
        hospRes.json(),
        deptRes.json(),
        jobTypeRes.json(),
        skillRes.json(),
      ]);

      if (provData.success) setProviders(provData.data || []);
      if (hospData.success) setHospitals(hospData.data || []);
      if (deptData.success) setDepartments(deptData.data || []);
      if (jobTypeData.success) setJobTypes(jobTypeData.data || []);
      if (skillData.success) setSkills(skillData.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filter departments by selected home hospital
  const filteredDepartments = departments.filter(
    (d) => d.hospital_id === formData.home_hospital_id
  );

  // Group skills by category
  const skillsByCategory = skills.reduce((acc, skill) => {
    if (!acc[skill.category]) acc[skill.category] = [];
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const csrfRes = await fetch('/api/csrf');
      const { csrfToken } = await csrfRes.json();

      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          job_type_id: formData.job_type_id,
          home_hospital_id: formData.home_hospital_id || null,
          home_department_id: formData.home_department_id || null,
          skills: formData.selectedSkills,
          hospital_access: formData.hospitalAccess,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        resetForm();
        fetchData();
      }
    } catch (error) {
      console.error('Error creating provider:', error);
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      email: '',
      phone: '',
      job_type_id: '',
      home_hospital_id: '',
      home_department_id: '',
      selectedSkills: [],
      hospitalAccess: [],
    });
  }

  function toggleSkill(skillId: string) {
    setFormData((prev) => ({
      ...prev,
      selectedSkills: prev.selectedSkills.includes(skillId)
        ? prev.selectedSkills.filter((s) => s !== skillId)
        : [...prev.selectedSkills, skillId],
    }));
  }

  function toggleHospitalAccess(hospitalId: string) {
    setFormData((prev) => ({
      ...prev,
      hospitalAccess: prev.hospitalAccess.includes(hospitalId)
        ? prev.hospitalAccess.filter((h) => h !== hospitalId)
        : [...prev.hospitalAccess, hospitalId],
    }));
  }

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadResults(null);
    setSubmitting(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        setUploadError('CSV file must have a header row and at least one data row');
        return;
      }

      // Parse header - support both new format and legacy format
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());

      // Check for legacy format (Role, Last Name, First Name, etc.)
      const isLegacyFormat = header.includes('role') && header.includes('last name') && header.includes('first name');

      let nameIdx = -1;
      let emailIdx = -1;
      let phoneIdx = -1;
      let typeIdx = -1;
      let skillsIdx = -1;
      let hospitalsIdx = -1;

      // Legacy format column indices
      let roleIdx = -1;
      let lastNameIdx = -1;
      let firstNameIdx = -1;
      let lifeNumberIdx = -1;
      let homeSiteIdx = -1;
      let homeDeptIdx = -1;
      let supervisingMDIdx = -1;
      let certificationIdx = -1;
      let experienceIdx = -1;
      let scheduleDaysIdx = -1;
      let scheduleTimeIdx = -1;

      if (isLegacyFormat) {
        // Map legacy columns
        roleIdx = header.indexOf('role');
        lastNameIdx = header.indexOf('last name');
        firstNameIdx = header.indexOf('first name');
        lifeNumberIdx = header.indexOf('life #');
        phoneIdx = header.indexOf('employee cell #');
        scheduleDaysIdx = header.findIndex(h => h.includes('schedule') && h.includes('days'));
        scheduleTimeIdx = header.findIndex(h => h.includes('schedule') && h.includes('time'));
        homeSiteIdx = header.indexOf('home site');
        homeDeptIdx = header.indexOf('home department');
        supervisingMDIdx = header.findIndex(h => h.includes('supervising') || h.includes('collaborating'));
        certificationIdx = header.findIndex(h => h.includes('certification'));
        experienceIdx = header.findIndex(h => h.includes('experience'));
        // Note: MSH Only, MSM/W Only, All 3 sites columns are ignored for now
      } else {
        // New format
        nameIdx = header.indexOf('name');
        emailIdx = header.indexOf('email');
        phoneIdx = header.indexOf('phone');
        typeIdx = header.findIndex((h) => h.includes('type') || h === 'job_type');
        skillsIdx = header.indexOf('skills');
        hospitalsIdx = header.indexOf('hospitals');

        if (nameIdx === -1 || emailIdx === -1) {
          setUploadError('CSV must have Name and Email columns (or use legacy format with Role, Last Name, First Name)');
          return;
        }
      }

      const csrfRes = await fetch('/api/csrf');
      const { csrfToken } = await csrfRes.json();

      let successCount = 0;
      let failedCount = 0;

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVRow(lines[i]);
        if (row.length === 0) continue;

        let name = '';
        let email = '';
        let phone = '';
        let typeName = '';
        let skillsStr = '';
        let hospitalsStr = '';
        let availabilityComments = '';
        let homeDepartmentName = '';
        let homeHospitalCode = '';

        if (isLegacyFormat) {
          // Legacy format processing
          const firstName = firstNameIdx !== -1 ? row[firstNameIdx]?.trim() : '';
          const lastName = lastNameIdx !== -1 ? row[lastNameIdx]?.trim() : '';

          // Skip empty rows
          if (!firstName && !lastName) continue;

          name = `${firstName} ${lastName}`.trim();

          // Generate placeholder email from name
          const emailBase = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(/[^a-z.]/g, '');
          email = `${emailBase}@placeholder.com`;

          phone = phoneIdx !== -1 ? row[phoneIdx]?.trim() : '';

          // Map role to job type
          const role = roleIdx !== -1 ? row[roleIdx]?.trim() : '';
          typeName = mapLegacyRole(role);

          // Get certification as skills
          const certification = certificationIdx !== -1 ? row[certificationIdx]?.trim() : '';
          skillsStr = certification;

          // Get home site
          homeHospitalCode = homeSiteIdx !== -1 ? row[homeSiteIdx]?.trim() : '';
          homeDepartmentName = homeDeptIdx !== -1 ? row[homeDeptIdx]?.trim() : '';

          // Build availability comments from extra fields
          const scheduleDays = scheduleDaysIdx !== -1 ? row[scheduleDaysIdx]?.trim() : '';
          const scheduleTime = scheduleTimeIdx !== -1 ? row[scheduleTimeIdx]?.trim() : '';
          const supervisingMD = supervisingMDIdx !== -1 ? row[supervisingMDIdx]?.trim() : '';
          const experience = experienceIdx !== -1 ? row[experienceIdx]?.trim() : '';
          const lifeNumber = lifeNumberIdx !== -1 ? row[lifeNumberIdx]?.trim() : '';

          const comments = [];
          if (lifeNumber) comments.push(`Life#: ${lifeNumber}`);
          if (scheduleDays) comments.push(`Schedule: ${scheduleDays}`);
          if (scheduleTime) comments.push(`Time: ${scheduleTime}`);
          if (supervisingMD) comments.push(`Supervising MD: ${supervisingMD}`);
          if (experience) comments.push(`Experience: ${experience}`);
          availabilityComments = comments.join('; ');

        } else {
          // New format processing
          name = row[nameIdx]?.trim() || '';
          email = row[emailIdx]?.trim() || '';
          phone = phoneIdx !== -1 ? row[phoneIdx]?.trim() : '';
          typeName = typeIdx !== -1 ? row[typeIdx]?.trim() : '';
          skillsStr = skillsIdx !== -1 ? row[skillsIdx]?.trim() : '';
          hospitalsStr = hospitalsIdx !== -1 ? row[hospitalsIdx]?.trim() : '';
        }

        if (!name) {
          failedCount++;
          continue;
        }

        // Find job type by code or name
        const jobType = jobTypes.find(
          (jt) => jt.code.toLowerCase() === typeName.toLowerCase() ||
                  jt.name.toLowerCase() === typeName.toLowerCase()
        );

        // Find skills by name (support pipe-separated or comma-separated)
        const skillNames = skillsStr.split(/[|,]/).map((s) => s.trim()).filter(Boolean);
        const skillIds = skillNames
          .map((sn) => skills.find((s) => s.name.toLowerCase().includes(sn.toLowerCase()) ||
                                          sn.toLowerCase().includes(s.name.toLowerCase()))?.id)
          .filter((id): id is string => !!id);

        // Find hospitals by short code (for new format)
        let hospitalIds: string[] = [];
        if (hospitalsStr) {
          const hospitalCodes = hospitalsStr.split('|').map((h) => h.trim()).filter(Boolean);
          hospitalIds = hospitalCodes
            .map((code) => hospitals.find((h) => h.short_code === code)?.id)
            .filter((id): id is string => !!id);
        }

        // For legacy format, find home hospital
        let homeHospitalId = '';
        let homeDepartmentId = '';
        if (homeHospitalCode) {
          const homeHospital = hospitals.find(h =>
            h.short_code.toLowerCase() === homeHospitalCode.toLowerCase() ||
            h.name.toLowerCase().includes(homeHospitalCode.toLowerCase())
          );
          if (homeHospital) {
            homeHospitalId = homeHospital.id;
            hospitalIds = [homeHospital.id]; // Set hospital access to home hospital

            // Find home department in that hospital
            if (homeDepartmentName) {
              const homeDept = departments.find(d =>
                d.hospital_id === homeHospital.id &&
                d.name.toLowerCase() === homeDepartmentName.toLowerCase()
              );
              if (homeDept) {
                homeDepartmentId = homeDept.id;
              }
            }
          }
        }

        try {
          const res = await fetch('/api/providers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify({
              name,
              email,
              phone: phone || null,
              job_type_id: jobType?.id || jobTypes[0]?.id,
              skills: skillIds,
              hospital_access: hospitalIds,
              home_hospital_id: homeHospitalId || null,
              home_department_id: homeDepartmentId || null,
              availability_comments: availabilityComments || null,
            }),
          });

          if (res.ok) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      }

      setUploadResults({ success: successCount, failed: failedCount });
      if (successCount > 0) {
        fetchData();
      }
    } catch (error) {
      console.error('CSV upload error:', error);
      setUploadError('Failed to process CSV file');
    } finally {
      setSubmitting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  // Map legacy role names to job type codes
  function mapLegacyRole(role: string): string {
    const roleMap: Record<string, string> = {
      'physician': 'MD',
      'doctor': 'MD',
      'md': 'MD',
      'np': 'NP',
      'nurse practitioner': 'NP',
      'pa': 'PA',
      'physician assistant': 'PA',
      'rn': 'RN',
      'registered nurse': 'RN',
      'fellow': 'FEL',
      'resident': 'RES',
      'cna': 'CNA',
      'lpn': 'LPN',
    };
    return roleMap[role.toLowerCase()] || role;
  }

  // Simple CSV row parser handling quoted values
  function parseCSVRow(row: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  function downloadTemplate() {
    const headers = 'Name,Email,Phone,Type,Skills,Hospitals';
    const example = 'Dr. John Smith,jsmith@email.com,555-1234,MD,BLS|ACLS|Cardiology Specialty,MSH|MSM';
    const csv = `${headers}\n${example}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'provider-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const availableProviders = providers.filter(
    (p) => !p.assignments?.some((a) => a.status !== 'Cancelled')
  );
  const assignedProviders = providers.filter((p) =>
    p.assignments?.some((a) => a.status !== 'Cancelled')
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Providers</h1>
          <p className="text-gray-600 mt-1">
            Manage your provider roster and availability
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => setShowUploadModal(true)}>
            Upload CSV
          </Button>
          <Button onClick={() => setShowModal(true)}>Add Provider</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{providers.length}</div>
          <div className="text-sm text-gray-600">Total Providers</div>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-4">
          <div className="text-2xl font-bold text-green-600">
            {availableProviders.length}
          </div>
          <div className="text-sm text-gray-600">Available</div>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <div className="text-2xl font-bold text-blue-600">
            {assignedProviders.length}
          </div>
          <div className="text-sm text-gray-600">Assigned</div>
        </div>
      </div>

      {/* Providers Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading providers...</p>
          </div>
        ) : providers.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">👩‍⚕️</div>
            <h3 className="text-lg font-medium text-gray-900">No providers yet</h3>
            <p className="text-gray-600 mt-1">
              Add providers manually or upload a CSV file
            </p>
            <div className="flex justify-center space-x-3 mt-4">
              <Button variant="outline" onClick={() => setShowUploadModal(true)}>
                Upload CSV
              </Button>
              <Button onClick={() => setShowModal(true)}>Add Provider</Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Provider
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Skills
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Hospitals
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {providers.map((provider) => {
                  const activeAssignment = provider.assignments?.find(
                    (a) => a.status !== 'Cancelled'
                  );
                  return (
                    <tr key={provider.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {provider.name}
                          </div>
                          <div className="text-sm text-gray-500">{provider.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {provider.job_types?.code || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {provider.provider_skills?.slice(0, 3).map((ps, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                            >
                              {ps.skills?.name}
                            </span>
                          ))}
                          {(provider.provider_skills?.length || 0) > 3 && (
                            <span className="text-xs text-gray-500">
                              +{provider.provider_skills!.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {provider.provider_hospital_access?.map((a, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700"
                            >
                              {a.hospitals?.short_code}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {activeAssignment ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Assigned
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Available
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-indigo-600 hover:text-indigo-900">
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Provider Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add New Provider</h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="e.g., Dr. John Smith, RN"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      placeholder="provider@email.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="555-123-4567"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Provider Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Provider Type *
                  </label>
                  <select
                    value={formData.job_type_id}
                    onChange={(e) => setFormData({ ...formData, job_type_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select type...</option>
                    {jobTypes.map((jt) => (
                      <option key={jt.id} value={jt.id}>
                        {jt.name} ({jt.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Home Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Home Hospital
                    </label>
                    <select
                      value={formData.home_hospital_id}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          home_hospital_id: e.target.value,
                          home_department_id: '',
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">No home hospital</option>
                      {hospitals.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.short_code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Home Department
                    </label>
                    <select
                      value={formData.home_department_id}
                      onChange={(e) =>
                        setFormData({ ...formData, home_department_id: e.target.value })
                      }
                      disabled={!formData.home_hospital_id}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                    >
                      <option value="">No home department</option>
                      {filteredDepartments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Skills & Certifications
                  </label>
                  <div className="space-y-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                      <div key={category}>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                          {category}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {categorySkills.map((skill) => {
                            const isSelected = formData.selectedSkills.includes(skill.id);
                            return (
                              <button
                                key={skill.id}
                                type="button"
                                onClick={() => toggleSkill(skill.id)}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                  isSelected
                                    ? 'bg-green-100 text-green-800 border border-green-300'
                                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                {skill.name} {isSelected && '✓'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hospital Access */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hospital Access (can work at)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {hospitals.map((hospital) => {
                      const isSelected = formData.hospitalAccess.includes(hospital.id);
                      return (
                        <button
                          key={hospital.id}
                          type="button"
                          onClick={() => toggleHospitalAccess(hospital.id)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-700 border border-gray-300 hover:border-indigo-300'
                          }`}
                        >
                          {hospital.short_code} - {hospital.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Adding...' : 'Add Provider'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Upload Providers CSV</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Supported CSV Formats</h3>

                {/* Legacy Format */}
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">Legacy Format (backward compatible):</p>
                  <code className="text-xs bg-gray-100 p-2 rounded block overflow-x-auto mb-2">
                    Role, Last Name, First Name, Life #, Employee Cell #, ...
                  </code>
                  <ul className="text-xs text-gray-500 space-y-1 ml-3">
                    <li>• <strong>Role</strong>: Physician, NP, PA, RN, etc.</li>
                    <li>• <strong>Home Site</strong>: Hospital short code (MSH, etc.)</li>
                    <li>• <strong>Home Department</strong>: Department name</li>
                    <li>• <strong>Certification</strong>: Maps to skills dropdown</li>
                    <li>• Hospital restriction columns (MSH Only, etc.) are ignored</li>
                  </ul>
                </div>

                {/* New Format */}
                <div className="border-t border-gray-200 pt-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">New Format:</p>
                  <code className="text-xs bg-gray-100 p-2 rounded block overflow-x-auto mb-2">
                    Name, Email, Phone, Type, Skills, Hospitals
                  </code>
                  <ul className="text-xs text-gray-500 space-y-1 ml-3">
                    <li>• <strong>Name</strong> and <strong>Email</strong> are required</li>
                    <li>• <strong>Type</strong>: Job type code (MD, RN, etc.)</li>
                    <li>• <strong>Skills</strong>: Pipe-separated (BLS|ACLS)</li>
                    <li>• <strong>Hospitals</strong>: Pipe-separated codes (MSH|MSM)</li>
                  </ul>
                </div>

                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={downloadTemplate}
                >
                  Download Template
                </Button>
              </div>

              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {uploadError}
                </div>
              )}

              {uploadResults && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  Upload complete: {uploadResults.success} successful, {uploadResults.failed} failed
                </div>
              )}

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <div className="text-4xl mb-2">📄</div>
                  <span className="text-sm font-medium text-indigo-600">
                    Click to upload CSV
                  </span>
                  <span className="text-xs text-gray-500 mt-1">or drag and drop</span>
                </label>
              </div>

              {submitting && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin h-6 w-6 border-4 border-indigo-600 border-t-transparent rounded-full mr-2"></div>
                  <span className="text-sm text-gray-600">Processing...</span>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadError(null);
                  setUploadResults(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
