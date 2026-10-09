import { switchInterfaceView } from '@/app/interface-view-actions'
import type { InterfaceView } from '@/lib/interface-view'

function optionClass(selected: boolean) {
  return [
    'inline-flex min-h-9 items-center justify-center rounded px-2.5 py-1.5 text-xs font-semibold transition',
    selected
      ? 'bg-gray-900 text-white'
      : 'bg-white text-gray-700 hover:bg-zinc-50',
  ].join(' ')
}

export default function InterfaceViewSwitcher({
  currentView,
  className = '',
}: {
  currentView: InterfaceView
  className?: string
}) {
  return (
    <div
      className={`inline-grid grid-cols-2 items-center gap-1 rounded-md border border-zinc-300 bg-zinc-100 p-1 ${className}`}
      aria-label="Interface view"
    >
      {(['admin', 'resource'] as const).map((view) => (
        <form action={switchInterfaceView} key={view} className="min-w-0">
          <input type="hidden" name="view" value={view} />
          <button
            type="submit"
            aria-pressed={currentView === view}
            disabled={currentView === view}
            className={`${optionClass(currentView === view)} w-full`}
          >
            {view === 'admin' ? 'Admin View' : 'Resource View'}
          </button>
        </form>
      ))}
    </div>
  )
}
