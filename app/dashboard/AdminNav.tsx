import Link from 'next/link'

import { isOperationalRole } from '@/lib/roles'

type Section =
  | 'profile'
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
}

const adminNavItems: NavItem[] = [
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
  { href: '/my-trip-sheets', key: 'my-trip-sheets', label: 'My Trip Sheets' },
]

function linkClass(isCurrent: boolean) {
  return [
    'rounded border px-3 py-2 text-sm font-medium transition',
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
  const navItems = isOperationalRole(role) ? resourceNavItems : adminNavItems

  return (
    <nav className={`mb-6 flex flex-wrap items-center gap-3 ${className}`}>
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
    </nav>
  )
}
