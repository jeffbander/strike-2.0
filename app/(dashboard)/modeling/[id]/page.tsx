'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Scenario {
  id: string;
  name: string;
  description?: string;
  hospital_id: string;
  hospitals?: { name: string; short_code: string };
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

interface ServiceConfig {
  id?: string;
  service_id: string;
  volume_percentage: number;
  operates_days: boolean | null;
  operates_nights: boolean | null;
  operates_weekends: boolean | null;
  day_capacity_override?: number;
  night_capacity_override?: number;
  weekend_capacity_override?: number;
  is_enabled: boolean;
}

interface StaffingResult {
  service_id: string;
  service_name: string;
  job_type_name: string;
  shift_type: string;
  original_positions: number;
  adjusted_positions: number;
}

export default function ScenarioConfigPage() {
  const params = useParams();
  const router = useRouter();
  const scenarioId = params.id as string;

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [configs, setConfigs] = useState<Map<string, ServiceConfig>>(new Map());
  const [staffingResults, setStaffingResults] = useState<StaffingResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // Quick preset percentages
  const presets = [100, 75, 50, 25, 10];

  useEffect(() => {
    fetchData();
  }, [scenarioId]);

  async function fetchData() {
    try {
      const [scenarioRes, servicesRes, configsRes] = await Promise.all([
        fetch(`/api/modeling/scenarios/${scenarioId}`),
        fetch('/api/services'),
        fetch(`/api/modeling/scenarios/${scenarioId}/configs`),
      ]);

      const [scenarioData, servicesData, configsData] = await Promise.all([
        scenarioRes.json(),
        servicesRes.json(),
        configsRes.json(),
      ]);

      if (scenarioData.success) {
        setScenario(scenarioData.data);
      } else {
        router.push('/modeling');
        return;
      }

      if (servicesData.success) {
        // Filter services by hospital
        const hospitalServices = (servicesData.data || []).filter(
          (s: Service) =>
            s.hospitals?.short_code === scenarioData.data?.hospitals?.short_code
        );
        setServices(hospitalServices);

        // Initialize configs for all services
        const configMap = new Map<string, ServiceConfig>();
        hospitalServices.forEach((service: Service) => {
          configMap.set(service.id, {
            service_id: service.id,
            volume_percentage: 100,
            operates_days: null,
            operates_nights: null,
            operates_weekends: null,
            is_enabled: true,
          });
        });

        // Override with saved configs
        if (configsData.success && configsData.data) {
          configsData.data.forEach((config: ServiceConfig) => {
            configMap.set(config.service_id, config);
          });
        }

        setConfigs(configMap);
      }

      // Fetch staffing calculation
      await calculateStaffing();
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function calculateStaffing() {
    setCalculating(true);
    try {
      const res = await fetch(
        `/api/modeling/scenarios/${scenarioId}/calculate`
      );
      const data = await res.json();
      if (data.success) {
        setStaffingResults(data.data || []);
      }
    } catch (error) {
      console.error('Error calculating staffing:', error);
    } finally {
      setCalculating(false);
    }
  }

  function updateConfig(serviceId: string, updates: Partial<ServiceConfig>) {
    setConfigs((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(serviceId) || {
        service_id: serviceId,
        volume_percentage: 100,
        operates_days: null,
        operates_nights: null,
        operates_weekends: null,
        is_enabled: true,
      };
      newMap.set(serviceId, { ...existing, ...updates });
      return newMap;
    });
  }

  function applyPresetToAll(percentage: number) {
    setConfigs((prev) => {
      const newMap = new Map(prev);
      newMap.forEach((config, serviceId) => {
        newMap.set(serviceId, { ...config, volume_percentage: percentage });
      });
      return newMap;
    });
  }

  function toggleAllServices(enabled: boolean) {
    setConfigs((prev) => {
      const newMap = new Map(prev);
      newMap.forEach((config, serviceId) => {
        newMap.set(serviceId, { ...config, is_enabled: enabled });
      });
      return newMap;
    });
  }

  function toggleShiftTypeForAll(
    shift: 'operates_days' | 'operates_nights' | 'operates_weekends',
    value: boolean | null
  ) {
    setConfigs((prev) => {
      const newMap = new Map(prev);
      newMap.forEach((config, serviceId) => {
        newMap.set(serviceId, { ...config, [shift]: value });
      });
      return newMap;
    });
  }

  async function saveConfigs() {
    setSaving(true);
    try {
      const csrfRes = await fetch('/api/csrf');
      const { csrfToken } = await csrfRes.json();

      const configArray = Array.from(configs.values());

      const res = await fetch(`/api/modeling/scenarios/${scenarioId}/configs`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ configs: configArray }),
      });

      const data = await res.json();
      if (data.success) {
        await calculateStaffing();
      } else {
        alert(data.error || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving configs:', error);
      alert('An error occurred');
    } finally {
      setSaving(false);
    }
  }

  // Aggregate staffing results
  const totalOriginal = staffingResults.reduce(
    (sum, r) => sum + r.original_positions,
    0
  );
  const totalAdjusted = staffingResults.reduce(
    (sum, r) => sum + r.adjusted_positions,
    0
  );
  const staffingChange =
    totalOriginal > 0
      ? ((totalAdjusted - totalOriginal) / totalOriginal) * 100
      : 0;

  // Group results by service for summary
  const byService = staffingResults.reduce((acc, result) => {
    if (!acc[result.service_name]) {
      acc[result.service_name] = { original: 0, adjusted: 0 };
    }
    acc[result.service_name].original += result.original_positions;
    acc[result.service_name].adjusted += result.adjusted_positions;
    return acc;
  }, {} as Record<string, { original: number; adjusted: number }>);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl p-6 animate-pulse">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded"></div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 animate-pulse">
            <div className="h-40 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Scenario not found</p>
        <Link href="/modeling">
          <Button className="mt-4">Back to Modeling</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/modeling" className="hover:text-indigo-600">
              Modeling
            </Link>
            <span>/</span>
            <span>{scenario.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{scenario.name}</h1>
          <p className="text-gray-600 mt-1">
            {scenario.hospitals?.name} • Configure service levels and calculate
            staffing needs
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/modeling">
            <Button variant="outline">Back</Button>
          </Link>
          <Button onClick={saveConfigs} loading={saving} disabled={saving}>
            Save & Calculate
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              Apply to all services:
            </span>
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => applyPresetToAll(p)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {p}%
              </button>
            ))}
          </div>
          <div className="border-l border-gray-200 pl-4 flex items-center gap-2">
            <button
              onClick={() => toggleAllServices(true)}
              className="px-3 py-1 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
            >
              Enable All
            </button>
            <button
              onClick={() => toggleAllServices(false)}
              className="px-3 py-1 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
            >
              Disable All
            </button>
          </div>
          <div className="border-l border-gray-200 pl-4 flex items-center gap-2">
            <span className="text-sm text-gray-600">Turn off:</span>
            <button
              onClick={() => toggleShiftTypeForAll('operates_nights', false)}
              className="px-3 py-1 text-sm border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              Nights
            </button>
            <button
              onClick={() => toggleShiftTypeForAll('operates_weekends', false)}
              className="px-3 py-1 text-sm border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors"
            >
              Weekends
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Configuration */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Service Configuration
          </h2>

          {services.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <p className="text-gray-600">
                No services found for this hospital
              </p>
              <Link href="/services/new">
                <Button className="mt-4" variant="outline">
                  Create Services
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {services.map((service) => {
                const config = configs.get(service.id);
                if (!config) return null;

                return (
                  <div
                    key={service.id}
                    className={cn(
                      'bg-white rounded-xl shadow-sm border p-4 transition-all',
                      config.is_enabled
                        ? 'border-gray-200'
                        : 'border-gray-200 bg-gray-50 opacity-60'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={config.is_enabled}
                          onChange={(e) =>
                            updateConfig(service.id, {
                              is_enabled: e.target.checked,
                            })
                          }
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {service.name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {service.departments?.name}
                          </p>
                        </div>
                      </div>

                      {/* Volume Percentage Slider */}
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">Volume:</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={config.volume_percentage}
                          onChange={(e) =>
                            updateConfig(service.id, {
                              volume_percentage: parseInt(e.target.value),
                            })
                          }
                          disabled={!config.is_enabled}
                          className="w-24"
                        />
                        <span className="text-sm font-medium w-12 text-right">
                          {config.volume_percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Operating Hours Toggles */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Hours:</span>
                      </div>

                      {/* Days */}
                      <label
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer transition-colors',
                          config.operates_days === null
                            ? service.operates_days
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-500'
                            : config.operates_days
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-500 line-through'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={
                            config.operates_days ?? service.operates_days
                          }
                          onChange={(e) =>
                            updateConfig(service.id, {
                              operates_days: e.target.checked,
                            })
                          }
                          disabled={!config.is_enabled}
                          className="h-3 w-3"
                        />
                        Days
                      </label>

                      {/* Nights */}
                      <label
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer transition-colors',
                          config.operates_nights === null
                            ? service.operates_nights
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-gray-100 text-gray-500'
                            : config.operates_nights
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-gray-100 text-gray-500 line-through'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={
                            config.operates_nights ?? service.operates_nights
                          }
                          onChange={(e) =>
                            updateConfig(service.id, {
                              operates_nights: e.target.checked,
                            })
                          }
                          disabled={!config.is_enabled}
                          className="h-3 w-3"
                        />
                        Nights
                      </label>

                      {/* Weekends */}
                      <label
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer transition-colors',
                          config.operates_weekends === null
                            ? service.operates_weekends
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-500'
                            : config.operates_weekends
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-500 line-through'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={
                            config.operates_weekends ?? service.operates_weekends
                          }
                          onChange={(e) =>
                            updateConfig(service.id, {
                              operates_weekends: e.target.checked,
                            })
                          }
                          disabled={!config.is_enabled}
                          className="h-3 w-3"
                        />
                        Weekends
                      </label>

                      {/* Original capacity info */}
                      <div className="ml-auto text-xs text-gray-400">
                        Original: D:{service.day_capacity || 0} / N:
                        {service.night_capacity || 0} / W:
                        {service.weekend_capacity || 0}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Staffing Summary
          </h2>

          {/* Overall Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Original Positions</span>
                <span className="text-lg font-semibold">{totalOriginal}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Adjusted Positions</span>
                <span className="text-lg font-semibold">{totalAdjusted}</span>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900">
                    Change
                  </span>
                  <span
                    className={cn(
                      'text-lg font-bold',
                      staffingChange < 0
                        ? 'text-green-600'
                        : staffingChange > 0
                        ? 'text-red-600'
                        : 'text-gray-900'
                    )}
                  >
                    {staffingChange > 0 ? '+' : ''}
                    {staffingChange.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* By Service Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              By Service
            </h3>
            {calculating ? (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 bg-gray-100 rounded"></div>
                ))}
              </div>
            ) : Object.keys(byService).length === 0 ? (
              <p className="text-sm text-gray-500">
                Save configuration to see staffing breakdown
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {Object.entries(byService).map(([name, data]) => {
                  const change =
                    data.original > 0
                      ? ((data.adjusted - data.original) / data.original) * 100
                      : 0;
                  return (
                    <div
                      key={name}
                      className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                          {name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {data.original} → {data.adjusted}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-sm font-medium',
                          change < 0
                            ? 'text-green-600'
                            : change > 0
                            ? 'text-red-600'
                            : 'text-gray-500'
                        )}
                      >
                        {change > 0 ? '+' : ''}
                        {change.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Info */}
          <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4">
            <h3 className="text-sm font-medium text-indigo-900 mb-2">
              How it works
            </h3>
            <ul className="text-xs text-indigo-700 space-y-1">
              <li>• Adjust volume % to scale staffing proportionally</li>
              <li>• Disable services to exclude from staffing</li>
              <li>• Turn off shifts (nights/weekends) to see impact</li>
              <li>• Click "Save & Calculate" to update projections</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
