'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

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
  units?: { name: string };
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices();
  }, []);

  async function fetchServices() {
    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      if (data.success) {
        setServices(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="text-gray-600 mt-1">
            Manage staffing services and shift requirements
          </p>
        </div>
        <Link href="/services/new">
          <Button>Create Service</Button>
        </Link>
      </div>

      {/* Services Grid */}
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
      ) : services.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">⚕️</div>
          <h3 className="text-lg font-medium text-gray-900">No services yet</h3>
          <p className="text-gray-600 mt-1">
            Create your first service to define staffing requirements
          </p>
          <Link href="/services/new">
            <Button className="mt-4">Create Service</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{service.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {service.departments?.name} • {service.hospitals?.short_code}
                  </p>
                </div>
                <span className="text-2xl">⚕️</span>
              </div>

              <div className="mt-4">
                <div className="text-sm text-gray-600 mb-2">Hours of Operation:</div>
                <div className="flex flex-wrap gap-2">
                  {service.operates_days && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                      ☀️ Days
                    </span>
                  )}
                  {service.operates_nights && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-indigo-100 text-indigo-800">
                      🌙 Nights
                    </span>
                  )}
                  {service.operates_weekends && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                      📅 Weekends
                    </span>
                  )}
                </div>
              </div>

              {(service.day_capacity ||
                service.night_capacity ||
                service.weekend_capacity) && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-sm text-gray-600 mb-2">Patient Capacity:</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {service.day_capacity && (
                      <div className="bg-gray-50 rounded p-2">
                        <div className="text-lg font-semibold text-gray-900">
                          {service.day_capacity}
                        </div>
                        <div className="text-xs text-gray-500">Day</div>
                      </div>
                    )}
                    {service.night_capacity && (
                      <div className="bg-gray-50 rounded p-2">
                        <div className="text-lg font-semibold text-gray-900">
                          {service.night_capacity}
                        </div>
                        <div className="text-xs text-gray-500">Night</div>
                      </div>
                    )}
                    {service.weekend_capacity && (
                      <div className="bg-gray-50 rounded p-2">
                        <div className="text-lg font-semibold text-gray-900">
                          {service.weekend_capacity}
                        </div>
                        <div className="text-xs text-gray-500">Weekend</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                <Link href={`/services/${service.id}`}>
                  <button className="text-sm text-indigo-600 hover:text-indigo-900 font-medium">
                    View Details →
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
