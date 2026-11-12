import Link from 'next/link'
import { notFound } from 'next/navigation'

import AdminNav from '@/app/dashboard/AdminNav'
import { teamPermissionLabels } from '../../permissions'
import {
  loadResourceAssignmentSchedule,
  requireScheduleAdmin,
} from '@/lib/resource-assignment-schedule.server'
import { parseScheduleFilter, selectScheduleTrips } from '@/lib/resource-assignment-schedule'
import { APP_TIME_ZONE } from '@/lib/time'
import ResourceScheduleRows from './ResourceScheduleRows'

export default async function ResourceAssignmentsPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ filter?: string | string[] }>
}) {
  const { profile } = await requireScheduleAdmin()
  const [{ id }, query] = await Promise.all([params, searchParams])
  const { resource, entries, error } = await loadResourceAssignmentSchedule(id)
  if (!resource && !error) notFound()
  const filter = parseScheduleFilter(query.filter)
  const schedule = selectScheduleTrips(entries, filter)

  return (
    <>
      <AdminNav current="resources" profile={profile} />
      <Link href="/dashboard/resources" className="ui-button ui-button-secondary mb-4">
        Back to Resources
      </Link>
      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">Assignment Schedule</h1>
          {resource ? (
            <div className="mt-2 space-y-2">
              <h2 className="break-words text-lg font-semibold">{resource.full_name?.trim() || resource.email || 'Unnamed resource'}</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`ui-badge ${resource.is_active ? 'ui-badge-green' : 'ui-badge-neutral'}`}>
                  {resource.is_active ? 'Active' : 'Inactive'}
                </span>
                <span>{teamPermissionLabels(resource).join(', ') || 'No roles'}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {error ? <p className="app-banner-error">{error}</p> : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Schedule filters" className="flex flex-wrap gap-2">
            {(['upcoming', 'past', 'all'] as const).map(value => (
              <Link key={value} href={`/dashboard/resources/${id}/assignments?filter=${value}`}
                aria-current={filter === value ? 'page' : undefined}
                className={`ui-button ${filter === value ? 'ui-button-primary' : 'ui-button-secondary'}`}>
                {value === 'upcoming' ? 'Upcoming' : value === 'past' ? 'Past' : 'All'}
              </Link>
            ))}
          </nav>
          <a href={`/dashboard/resources/${id}/assignments/pdf?filter=${filter}`}
            className="ui-button ui-button-secondary" download>
            Download PDF
          </a>
          </div>
          <p className="mb-3 text-xs text-gray-500">Times shown in {APP_TIME_ZONE}. Upcoming includes ongoing assignments. Dates and session counts reflect the selected filter; dates cover scheduled sessions, not continuous or full-trip assignment.</p>
          {schedule.length ? (
            <div className="app-table-wrap">
              <table className="app-table min-w-[680px] table-fixed">
                <colgroup><col className="w-[26%]" /><col className="w-[38%]" /><col className="w-[22%]" /><col className="w-[14%]" /></colgroup>
                <thead><tr>
                  {['Assigned dates', 'School / Trip', 'Destination', 'Sessions'].map(label => (
                    <th key={label} scope="col" className="px-3 py-2 font-medium text-gray-700">{label}</th>
                  ))}
                </tr></thead>
                <ResourceScheduleRows trips={schedule} />
              </table>
            </div>
          ) : (
            <div className="app-section-card text-sm text-gray-600">
              {filter === 'all' ? 'No non-archived assignments for this resource.' : `No ${filter === 'upcoming' ? 'ongoing or upcoming' : 'past'} assignments for this resource.`}
            </div>
          )}
        </>
      )}
    </>
  )
}
