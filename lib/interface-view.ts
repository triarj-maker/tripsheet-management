import {
  canAccessAssignedWork,
  isAdminRole,
  type PermissionProfile,
} from '@/lib/roles'

export const INTERFACE_VIEW_COOKIE = 'echo-interface-view'
export const INTERFACE_VIEWS = ['admin', 'resource'] as const

export type InterfaceView = (typeof INTERFACE_VIEWS)[number]

export function parseInterfaceView(value: unknown): InterfaceView | null {
  return value === 'admin' || value === 'resource' ? value : null
}

export function serializeInterfaceViewPreference(userId: string, view: InterfaceView) {
  return `v1:${userId}:${view}`
}

export function parseInterfaceViewPreference(
  value: string | null | undefined,
  userId: string
): InterfaceView | null {
  for (const view of INTERFACE_VIEWS) {
    if (value === serializeInterfaceViewPreference(userId, view)) return view
  }

  return null
}

export function getEffectiveInterfaceView(
  profile: PermissionProfile | null | undefined,
  preference: InterfaceView | null = null
): InterfaceView | null {
  if (isAdminRole(profile)) return preference ?? 'admin'
  if (canAccessAssignedWork(profile)) return 'resource'
  return null
}

export function getInterfaceViewHomePath(view: InterfaceView) {
  return view === 'admin' ? '/dashboard/trips' : '/my-trips'
}
