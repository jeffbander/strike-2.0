'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  Building,
  Layers,
  Stethoscope,
  Users,
  GitMerge,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Shield,
  UserPlus,
} from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { useState } from 'react';

type UserRole = 'super_admin' | 'health_system_admin' | 'hospital_admin' | 'departmental_admin';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[]; // If undefined, visible to all authenticated users
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Health Systems', href: '/health-systems', icon: Building2, roles: ['super_admin'] },
  { name: 'Hospitals', href: '/hospitals', icon: Building, roles: ['super_admin', 'health_system_admin'] },
  { name: 'Departments', href: '/departments', icon: Layers },
  { name: 'Units', href: '/units', icon: Building },
  { name: 'Services', href: '/services', icon: Stethoscope },
  { name: 'Providers', href: '/providers', icon: Users },
  { name: 'Matching', href: '/matching', icon: GitMerge },
];

const adminNavigation: NavItem[] = [
  {
    name: 'User Management',
    href: '/admin/users',
    icon: UserPlus,
    roles: ['super_admin', 'health_system_admin', 'hospital_admin', 'departmental_admin']
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const userRole = user?.publicMetadata?.role as UserRole | undefined;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Filter navigation items based on user role
  const filterNavItems = (items: NavItem[]) => {
    return items.filter(item => {
      if (!item.roles) return true; // No role restriction
      if (!userRole) return false; // User has no role
      return item.roles.includes(userRole);
    });
  };

  const visibleNavigation = filterNavItems(navigation);
  const visibleAdminNavigation = filterNavItems(adminNavigation);

  return (
    <>
      {/* Mobile menu button */}
      <button
        type="button"
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-sidebar-bg text-sidebar-text"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar-bg transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header */}
        <div className={cn('flex h-16 items-center border-b border-sidebar-hover px-4', collapsed && 'justify-center')}>
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Stethoscope className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">Strike Prep</span>
            </Link>
          )}
          {collapsed && (
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Stethoscope className="h-5 w-5 text-white" />
            </div>
          )}

          {/* Mobile close button */}
          <button
            type="button"
            className="ml-auto lg:hidden p-1 text-sidebar-text hover:text-white"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {visibleNavigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-active text-white'
                        : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white',
                      collapsed && 'justify-center'
                    )}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Admin Section */}
          {visibleAdminNavigation.length > 0 && (
            <>
              <div className={cn('mt-6 mb-2 px-4', collapsed && 'px-2')}>
                {!collapsed && (
                  <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-text/60">
                    Administration
                  </p>
                )}
                {collapsed && <hr className="border-sidebar-hover" />}
              </div>
              <ul className="space-y-1 px-2">
                {visibleAdminNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-sidebar-active text-white'
                            : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white',
                          collapsed && 'justify-center'
                        )}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? item.name : undefined}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {!collapsed && <span>{item.name}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-hover p-4">
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'h-9 w-9',
                },
              }}
            />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">Account</p>
                <p className="text-xs text-sidebar-text truncate">Settings</p>
              </div>
            )}
          </div>
        </div>

        {/* Collapse toggle (desktop only) */}
        <button
          type="button"
          className="hidden lg:flex absolute -right-3 top-20 h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted hover:text-foreground shadow-sm"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </aside>
    </>
  );
}
