import { operationalRoles, type PermissionProfile } from '@/lib/roles'
import { TEAM_PERMISSIONS_FORM } from './permissions'

type TeamPermissionFieldsProps = { profile?: PermissionProfile }

export default function TeamPermissionFields({ profile }: TeamPermissionFieldsProps) {
  const memberships = operationalRoles(profile)

  return (
    <>
      <input type="hidden" name="permissions_form" value={TEAM_PERMISSIONS_FORM} />
      <fieldset className="space-y-2">
        <legend className="ui-label">Administrative Access</legend>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input type="checkbox" name="is_admin" defaultChecked={profile?.is_admin === true} />
          <span>Administrator</span>
        </label>
      </fieldset>

      <fieldset className="space-y-2" aria-describedby="team-permission-help">
        <legend className="ui-label">Operational Roles</legend>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input type="checkbox" name="operational_roles" value="facilitator"
            defaultChecked={memberships.includes('facilitator')} />
          <span>Facilitator</span>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input type="checkbox" name="operational_roles" value="expert"
            defaultChecked={memberships.includes('expert')} />
          <span>Expert</span>
        </label>
        <p id="team-permission-help" className="text-sm text-gray-600">
          Select all that apply. Active users need Administrator access or at least one operational role.
        </p>
      </fieldset>
    </>
  )
}
