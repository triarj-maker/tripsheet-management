import Link from 'next/link'

type Section =
  | 'profile'
  | 'trips'
  | 'calendar'
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

type NavGroup = {
  label: string
  items: NavItem[]
}

const adminNavGroups: NavGroup[] = [
  {
    label: 'Operations',
    items: [
  { href: '/dashboard/trips', key: 'trips', label: 'Trips' },
  { href: '/dashboard/calendar', key: 'calendar', label: 'Calendar' },
  { href: '/dashboard/templates', key: 'templates', label: 'Templates' },
  { href: '/dashboard/resources', key: 'resources', label: 'Resources' },
    ],
  },
  {
    label: 'My Work',
    items: [
      { href: '/my-trips', key: 'my-trips', label: 'My Trips' },
      { href: '/my-trip-sheets', key: 'my-trip-sheets', label: 'My Trip Sheets' },
    ],
  },
  {
    label: 'Account',
    items: [{ href: '/dashboard', key: 'profile', label: 'Profile' }],
  },
]

const resourceNavGroups: NavGroup[] = [
  {
    label: 'My Work',
    items: [
      { href: '/my-trips', key: 'my-trips', label: 'My Trips' },
      { href: '/my-trip-sheets', key: 'my-trip-sheets', label: 'My Trip Sheets' },
    ],
  },
  {
    label: 'Account',
    items: [{ href: '/dashboard', key: 'profile', label: 'Profile' }],
  },
]

function linkClass(isCurrent: boolean) {
  return [
    'rounded border border-zinc-300 px-3 py-2 text-sm font-medium',
    isCurrent ? 'bg-zinc-100 text-gray-900' : 'bg-white text-gray-900',
  ].join(' ')
}

export default function AdminNav({
  current,
  role = 'admin',
  className = '',
}: AdminNavProps) {
  const navGroups = role === 'resource' ? resourceNavGroups : adminNavGroups

  return (
    <nav className={`mb-6 flex flex-wrap items-start gap-5 ${className}`}>
      {navGroups.map((group) => (
        <div key={group.label} className="min-w-0 space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={linkClass(item.key === current)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}
