import Link from 'next/link'

import { isOperationalRole } from '@/lib/roles'

type Section =
  | 'profile'
  | 'overview'
  | 'trips'
  | 'calendar'
  | 'companies'
  | 'schools'
  | 'my-trips'
  | 'templates'
  | 'resources'
  | 'my-trip-sheets'

type AdminNavProps = {
  current: Section
  role?: string | null
  className?: string
}

type NavItem = {
  href: string
  key: Section
  label: string
  mobileLabel?: string
}

const adminNavItems: NavItem[] = [
  { href: '/dashboard/overview', key: 'overview', label: 'Overview' },
  { href: '/dashboard/trips', key: 'trips', label: 'Trips' },
  { href: '/dashboard/calendar', key: 'calendar', label: 'Calendar' },
  { href: '/dashboard/companies', key: 'companies', label: 'Companies' },
  { href: '/dashboard/schools', key: 'schools', label: 'Schools' },
  { href: '/dashboard/templates', key: 'templates', label: 'Templates' },
  { href: '/dashboard/resources', key: 'resources', label: 'Team' },
  { href: '/my-trips', key: 'my-trips', label: 'My Trips' },
  { href: '/my-trip-sheets', key: 'my-trip-sheets', label: 'My Trip Sheets' },
]

const resourceNavItems: NavItem[] = [
  { href: '/my-trips', key: 'my-trips', label: 'My Trips' },
  {
    href: '/my-trip-sheets',
    key: 'my-trip-sheets',
    label: 'My Trip Sheets',
    mobileLabel: 'My Sheets',
  },
]

const profileNavItem: NavItem = {
  href: '/dashboard',
  key: 'profile',
  label: 'Profile',
}

function linkClass(isCurrent: boolean) {
  return [
    'inline-flex items-center justify-center whitespace-nowrap rounded border px-3 py-2 text-sm font-medium transition',
    isCurrent
      ? 'border-gray-900 bg-gray-900 text-white'
      : 'border-zinc-300 bg-white text-gray-900 hover:bg-zinc-50',
  ].join(' ')
}

export default function AdminNav({
  current,
  role = 'admin',
  className = '',
}: AdminNavProps) {
  const isResourceNav = isOperationalRole(role)
  const navItems = isResourceNav ? resourceNavItems : adminNavItems
  const mobileNavItems = isResourceNav
    ? [...resourceNavItems, profileNavItem]
    : [...adminNavItems, profileNavItem]

  return (
    <nav className={`mb-4 md:mb-6 ${className}`}>
      <div className="hidden flex-wrap items-center gap-3 md:flex">
        <div className="mr-2 min-w-[8.5rem] leading-tight">
          <p className="text-sm font-semibold text-gray-950">Trip Management</p>
          <p className="text-xs font-medium text-gray-500">Echo Journeys</p>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={linkClass(item.key === current)}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <Link href="/dashboard" className={linkClass(current === 'profile')}>
          Profile
        </Link>
      </div>

      {isResourceNav ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:hidden">
          {mobileNavItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`${linkClass(item.key === current)} flex-1 px-2`}
            >
              {item.mobileLabel ?? item.label}
            </Link>
          ))}
        </div>
      ) : (
        <details className="relative md:hidden">
          <summary className="inline-flex min-h-10 cursor-pointer list-none items-center justify-center whitespace-nowrap rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-zinc-50">
            Menu
          </summary>
          <div className="absolute left-0 z-20 mt-2 grid w-56 gap-2 rounded border border-zinc-200 bg-white p-2 shadow-lg">
            {mobileNavItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={linkClass(item.key === current)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </details>
      )}
    </nav>
  )
}
