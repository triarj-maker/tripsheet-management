export const APP_ROLES = ['admin', 'facilitator', 'expert'] as const
export const LEGACY_RESOURCE_ROLE = 'resource' as const
export const OPERATIONAL_ROLES = [
  'facilitator',
  'expert',
  LEGACY_RESOURCE_ROLE,
] as const
export const ASSIGNABLE_ROLES = [
  'admin',
  'facilitator',
  'expert',
  LEGACY_RESOURCE_ROLE,
] as const

export type AppRole = (typeof APP_ROLES)[number]
export type LegacyResourceRole = typeof LEGACY_RESOURCE_ROLE
export type SupportedRole = AppRole | LegacyResourceRole

function isOneOfRoleValues<TValue extends readonly string[]>(
  value: string | null | undefined,
  roleValues: TValue
): value is TValue[number] {
  return Boolean(value && roleValues.includes(value))
}

export function isAdminRole(role: string | null | undefined) {
  return role === 'admin'
}

export function isLegacyResourceRole(
  role: string | null | undefined
): role is LegacyResourceRole {
  return role === LEGACY_RESOURCE_ROLE
}

export function isOperationalRole(
  role: string | null | undefined
): role is (typeof OPERATIONAL_ROLES)[number] {
  return isOneOfRoleValues(role, OPERATIONAL_ROLES)
}

export function canAccessAssignedWork(role: string | null | undefined) {
  return isAdminRole(role) || isOperationalRole(role)
}

export function canBeAssignedToTripSheet(
  role: string | null | undefined
): role is (typeof ASSIGNABLE_ROLES)[number] {
  return isOneOfRoleValues(role, ASSIGNABLE_ROLES)
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
