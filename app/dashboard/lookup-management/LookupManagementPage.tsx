import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import AdminNav from '@/app/dashboard/AdminNav'

type LookupSection = 'companies' | 'schools'

type LookupRow = {
  id: string
  name: string | null
  is_active: boolean | null
}

type LookupManagementPageProps = {
  current: LookupSection
  title: string
  subtitle: string
  addLabel: string
  emptyLabel: string
  rows: LookupRow[]
  errorMessage?: string | null
  queryError?: string
  createAction: (formData: FormData) => void
  updateAction: (formData: FormData) => void
  toggleAction: (formData: FormData) => void
}

function statusBadgeClass(isActive: boolean | null) {
  return ['ui-badge', isActive ? 'ui-badge-green' : 'ui-badge-neutral'].join(' ')
}

export default function LookupManagementPage({
  current,
  title,
  subtitle,
  addLabel,
  emptyLabel,
  rows,
  errorMessage,
  queryError,
  createAction,
  updateAction,
  toggleAction,
}: LookupManagementPageProps) {
  return (
    <>
      <AdminNav current={current} />

      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">{title}</h1>
          <p className="app-page-subtitle">{subtitle}</p>
        </div>
      </div>

      {queryError ? <p className="app-banner-error">{queryError}</p> : null}
      {errorMessage ? <p className="app-banner-error">{errorMessage}</p> : null}

      <section className="app-section-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{addLabel}</h2>
        </div>

        <form action={createAction} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <label htmlFor={`${current}_name`} className="ui-label">Name</label>
            <input
              id={`${current}_name`}
              name="name"
              type="text"
              required
              className="ui-input ui-input-compact"
            />
          </div>
          <ActionSubmitButton
            idleLabel="Add"
            pendingLabel="Adding..."
            className="ui-button-primary ui-button-compact"
          />
        </form>
      </section>

      <div className="app-table-wrap">
        <table className="app-table">
          <thead>
            <tr>
              <th className="px-4 py-3 font-medium text-gray-700">Name</th>
              <th className="w-[9rem] px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="w-[20rem] px-4 py-3 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-5 text-gray-700">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const rowId = row.id ?? ''
                const rowName = row.name ?? ''
                const isActive = row.is_active === true

                return (
                  <tr key={rowId} className={isActive ? 'align-top' : 'align-top opacity-70'}>
                    <td className="px-4 py-3 text-gray-900">
                      <form
                        id={`${current}-update-${rowId}`}
                        action={updateAction}
                        className="space-y-2"
                      >
                        <input type="hidden" name="id" value={rowId} />
                        <input
                          type="hidden"
                          name="is_active"
                          value={isActive ? 'on' : ''}
                        />
                        <input
                          name="name"
                          type="text"
                          defaultValue={rowName}
                          required
                          className="ui-input ui-input-compact"
                        />
                      </form>
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusBadgeClass(isActive)}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <ActionSubmitButton
                          form={`${current}-update-${rowId}`}
                          idleLabel="Save"
                          pendingLabel="Saving..."
                          className="ui-button-secondary ui-button-compact"
                        />
                        <form action={toggleAction}>
                          <input type="hidden" name="id" value={rowId} />
                          <input
                            type="hidden"
                            name="next_is_active"
                            value={isActive ? 'false' : 'true'}
                          />
                          <ActionSubmitButton
                            idleLabel={isActive ? 'Deactivate' : 'Activate'}
                            pendingLabel="Saving..."
                            className="ui-button-secondary ui-button-compact"
                          />
                        </form>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
