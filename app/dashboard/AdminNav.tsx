import Link from 'next/link'

type Section =
  | 'profile'
  | 'trip-sheets'
  | 'calendar'
  | 'templates'
  | 'resources'
  | 'my-trip-sheets'

type AdminNavProps = {
  current: Section
  role?: string | null
}

const adminNavItems: Array<{
  href: string
  key: Section
  label: string
}> = [
  { href: '/dashboard/trip-sheets', key: 'trip-sheets', label: 'Trip Sheets' },
  { href: '/dashboard/calendar', key: 'calendar', label: 'Calendar' },
  { href: '/dashboard/templates', key: 'templates', label: 'Templates' },
  { href: '/dashboard/resources', key: 'resources', label: 'Resources' },
  { href: '/dashboard', key: 'profile', label: 'Profile' },
]

const resourceNavItems: Array<{
  href: string
  key: Section
  label: string
}> = [{ href: '/my-trip-sheets', key: 'my-trip-sheets', label: 'My Trip Sheets' }]

function linkClass(isCurrent: boolean) {
  return [
    'rounded border border-zinc-300 px-3 py-2 text-sm font-medium',
    isCurrent ? 'bg-zinc-100 text-gray-900' : 'text-gray-900',
  ].join(' ')
}

export default function AdminNav({ current, role = 'admin' }: AdminNavProps) {
  const navItems = role === 'resource' ? resourceNavItems : adminNavItems

  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {navItems.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={linkClass(item.key === current)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
