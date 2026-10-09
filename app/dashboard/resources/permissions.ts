import { operationalRoles, type PermissionProfile } from '@/lib/roles'

export const TEAM_PERMISSIONS_FORM = 'multi-role-v1'

type TeamPermissions = {
  isAdmin: boolean
  roles: Array<'facilitator' | 'expert'>
  isActive: boolean
}

export function parseTeamPermissions(formData: FormData):
  | { permissions: TeamPermissions; error: null }
  | { permissions: null; error: string } {
  // A missing form marker must not turn an old or incomplete form into removals.
  // This is format validation, not authorization: actions and the RPC both guard access.
  if (formData.getAll('permissions_form').length !== 1 ||
      formData.get('permissions_form') !== TEAM_PERMISSIONS_FORM || formData.has('role')) {
    return { permissions: null, error: 'This Team form is out of date. Reload the page and try again.' }
  }

  const adminValues = formData.getAll('is_admin')
  const activeValues = formData.getAll('is_active')
  const roleValues = formData.getAll('operational_roles')
  if (adminValues.length > 1 || activeValues.length > 1 ||
      adminValues.some(value => value !== 'on') || activeValues.some(value => value !== 'on') ||
      roleValues.some(value => value !== 'facilitator' && value !== 'expert')) {
    return { permissions: null, error: 'Invalid permission selection. Reload the page and try again.' }
  }

  const isAdmin = adminValues.length === 1
  const isActive = activeValues.length === 1
  const roles = [...new Set(roleValues)] as TeamPermissions['roles']
  if (isActive && !isAdmin && roles.length === 0) {
    return { permissions: null, error: 'Active users need Administrator access or at least one operational role.' }
  }
  return { permissions: { isAdmin, roles, isActive }, error: null }
}

export function teamPermissionLabels(profile: PermissionProfile) {
  return [
    ...(profile.is_admin === true ? ['Administrator'] : []),
    ...operationalRoles(profile).map(role => role === 'facilitator' ? 'Facilitator' : 'Expert'),
  ]
}
