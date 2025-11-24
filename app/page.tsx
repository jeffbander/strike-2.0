import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function Home() {
  const { userId } = await auth();

  // Redirect authenticated users to dashboard
  if (userId) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-3xl mr-2">🎯</span>
            <span className="text-xl font-bold text-gray-900">Strike Prep</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/sign-in"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Healthcare Strike Capacity
            <span className="text-indigo-600"> Management</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Plan and execute strike coverage with precision. Match qualified
            replacement providers to critical care positions across your entire
            health system.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/sign-up"
              className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-medium text-lg hover:bg-indigo-700 transition-colors"
            >
              Start Planning
            </Link>
            <Link
              href="/sign-in"
              className="border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-medium text-lg hover:border-gray-400 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-24 grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon="🏥"
            title="Multi-Hospital Support"
            description="Manage coverage across your entire health system with hierarchical organization from departments to shifts."
          />
          <FeatureCard
            icon="👥"
            title="Smart Provider Matching"
            description="Our algorithm matches providers to positions based on skills, certifications, and department experience."
          />
          <FeatureCard
            icon="📊"
            title="Real-Time Dashboard"
            description="Track coverage status, identify gaps, and monitor assignments with live capacity dashboards."
          />
          <FeatureCard
            icon="🔒"
            title="Secure & Compliant"
            description="Healthcare-grade security with role-based access control and complete audit logging."
          />
          <FeatureCard
            icon="📋"
            title="Bulk Operations"
            description="Import providers via CSV, auto-generate shifts, and export coverage plans to Excel."
          />
          <FeatureCard
            icon="⚡"
            title="Instant Assignments"
            description="One-click assignments with automatic conflict detection and capacity verification."
          />
        </div>

        {/* How It Works */}
        <div className="mt-24">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            <StepCard
              step={1}
              title="Configure Hierarchy"
              description="Set up hospitals, departments, and services in your health system."
            />
            <StepCard
              step={2}
              title="Define Positions"
              description="Create shifts with required skills and job types for each service."
            />
            <StepCard
              step={3}
              title="Import Providers"
              description="Add replacement providers with their certifications and skills."
            />
            <StepCard
              step={4}
              title="Match & Assign"
              description="Use smart matching to fill positions and export your coverage plan."
            />
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-24 bg-indigo-600 rounded-2xl p-12 text-white">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold">98%</div>
              <div className="text-indigo-200 mt-1">Coverage Rate</div>
            </div>
            <div>
              <div className="text-4xl font-bold">50+</div>
              <div className="text-indigo-200 mt-1">Hospitals Supported</div>
            </div>
            <div>
              <div className="text-4xl font-bold">10K+</div>
              <div className="text-indigo-200 mt-1">Positions Matched</div>
            </div>
            <div>
              <div className="text-4xl font-bold">24/7</div>
              <div className="text-indigo-200 mt-1">System Availability</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 mt-12 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-2xl mr-2">🎯</span>
            <span className="text-lg font-semibold text-gray-900">Strike Prep</span>
          </div>
          <p className="text-gray-500 text-sm">
            Healthcare Capacity Management System
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-indigo-600 font-bold text-lg">{step}</span>
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}
