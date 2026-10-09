export const APP_ROLES = ['admin', 'facilitator', 'expert'] as const
export const LEGACY_RESOURCE_ROLE = 'resource' as const
export const OPERATIONAL_ROLES = ['facilitator', 'expert'] as const

export type AppRole = (typeof APP_ROLES)[number]
export type LegacyResourceRole = typeof LEGACY_RESOURCE_ROLE
export type SupportedRole = AppRole | LegacyResourceRole

// Authorization never reads the compatibility role string.
export type PermissionProfile = {
  is_admin?: boolean | null
  is_active?: boolean | null
  profile_operational_roles?: Array<{ role_code: string }> | null
}

export function operationalRoles(profile: PermissionProfile | null | undefined) {
  return [...new Set((profile?.profile_operational_roles ?? [])
    .map(({ role_code }) => role_code)
    .filter((code): code is 'facilitator' | 'expert' => code === 'facilitator' || code === 'expert'))]
}

export function isAdminRole(profile: PermissionProfile | null | undefined) {
  return profile?.is_active === true && profile.is_admin === true
}

// Resource interface selection: Admins retain their administrative interface.
export function isOperationalRole(profile: PermissionProfile | null | undefined) {
  return profile?.is_active === true && !isAdminRole(profile) && operationalRoles(profile).length > 0
}

export function isLegacyResourceRole(role: string | null | undefined): role is LegacyResourceRole {
  return role === LEGACY_RESOURCE_ROLE
}

export function canAccessAssignedWork(profile: PermissionProfile | null | undefined) {
  return isAdminRole(profile) || isOperationalRole(profile)
}

export const canBeAssignedToTripSheet = canAccessAssignedWork

export function eligibleProfiles<T extends PermissionProfile & { id: string }>(profiles: T[]) {
  return [...new Map(profiles.filter(canBeAssignedToTripSheet).map(p => [p.id, p])).values()]
}

export function visibleCardCategories(profile: PermissionProfile | null | undefined) {
  if (profile?.is_active !== true) return []
  return isAdminRole(profile) ? ['facilitator', 'expert'] : operationalRoles(profile)
}

export function getPermissionLabel(profile: PermissionProfile | null | undefined) {
  return [profile?.is_admin ? 'Admin' : '', ...operationalRoles(profile).map(getRoleLabel)].filter(Boolean).join(' + ') || '-'
}

export function getRoleLabel(role: string | null | undefined) {
  switch (role) {
    case 'admin':
      return 'Admin'
    case 'facilitator':
      return 'Facilitator'
    case 'expert':
      return 'Expert'
    case LEGACY_RESOURCE_ROLE:
      return 'Resource (Legacy)'
    default:
      return role?.trim() || '-'
  }
}
