import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Users,
  BarChart3,
  Shield,
  FileSpreadsheet,
  Zap,
  Stethoscope,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
                <Stethoscope className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">Strike Prep</span>
            </Link>
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link href="/sign-in">Sign In</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-light text-primary text-sm font-medium mb-6">
              <Shield className="h-4 w-4" />
              Healthcare-Grade Security & Compliance
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Healthcare Strike Capacity{' '}
              <span className="text-primary">Management</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted max-w-2xl mx-auto mb-10">
              Plan and execute strike coverage with precision. Match qualified
              replacement providers to critical care positions across your entire
              health system.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/sign-up">
                  Start Planning
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/sign-in">Sign In to Dashboard</Link>
              </Button>
            </div>
          </div>

          {/* Hero Image Placeholder */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none h-32 bottom-0 top-auto" />
            <div className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
              <div className="bg-sidebar-bg h-10 flex items-center px-4 gap-2">
                <div className="h-3 w-3 rounded-full bg-danger" />
                <div className="h-3 w-3 rounded-full bg-warning" />
                <div className="h-3 w-3 rounded-full bg-success" />
              </div>
              <div className="p-8 bg-gradient-to-br from-primary-light/50 to-background">
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <StatPreview label="Coverage Rate" value="98%" />
                  <StatPreview label="Open Positions" value="12" />
                  <StatPreview label="Providers Available" value="156" />
                  <StatPreview label="Hospitals" value="8" />
                </div>
                <div className="h-48 bg-card rounded-lg border border-border flex items-center justify-center">
                  <BarChart3 className="h-24 w-24 text-border" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-card">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Everything You Need for Strike Coverage
            </h2>
            <p className="text-lg text-muted max-w-2xl mx-auto">
              A complete platform designed specifically for healthcare capacity management
              during labor actions.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={Building2}
              title="Multi-Hospital Support"
              description="Manage coverage across your entire health system with hierarchical organization from departments to shifts."
            />
            <FeatureCard
              icon={Users}
              title="Smart Provider Matching"
              description="Our algorithm matches providers to positions based on skills, certifications, and department experience."
            />
            <FeatureCard
              icon={BarChart3}
              title="Real-Time Dashboard"
              description="Track coverage status, identify gaps, and monitor assignments with live capacity dashboards."
            />
            <FeatureCard
              icon={Shield}
              title="Secure & Compliant"
              description="Healthcare-grade security with role-based access control and complete audit logging."
            />
            <FeatureCard
              icon={FileSpreadsheet}
              title="Bulk Operations"
              description="Import providers via CSV, auto-generate shifts, and export coverage plans to Excel."
            />
            <FeatureCard
              icon={Zap}
              title="Instant Assignments"
              description="One-click assignments with automatic conflict detection and capacity verification."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted">
              Get your strike coverage plan ready in four simple steps.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
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
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-primary rounded-2xl p-8 sm:p-12 text-white">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
              <StatBlock value="98%" label="Coverage Rate" />
              <StatBlock value="50+" label="Hospitals Supported" />
              <StatBlock value="10K+" label="Positions Matched" />
              <StatBlock value="24/7" label="System Availability" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-card">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Ready to Secure Your Coverage?
          </h2>
          <p className="text-lg text-muted mb-8">
            Join healthcare systems across the country in ensuring patient care
            continuity during labor actions.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/sign-up">
                Create Free Account
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-muted">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              No credit card required
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Free for small health systems
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Setup in minutes
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Stethoscope className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-foreground">Strike Prep</span>
          </div>
          <p className="text-muted text-sm">
            Healthcare Capacity Management System
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-background rounded-xl p-6 border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-200 group">
      <div className="h-12 w-12 rounded-lg bg-primary-light flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-110 transition-all duration-200">
        <Icon className="h-6 w-6 text-primary group-hover:text-white transition-colors" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted">{description}</p>
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
    <div className="text-center group">
      <div className="h-14 w-14 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-4 group-hover:bg-primary group-hover:scale-110 transition-all duration-200">
        <span className="text-primary font-bold text-xl group-hover:text-white transition-colors">
          {step}
        </span>
      </div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted">{description}</p>
    </div>
  );
}

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-4xl sm:text-5xl font-bold">{value}</div>
      <div className="text-primary-light mt-1">{label}</div>
    </div>
  );
}
