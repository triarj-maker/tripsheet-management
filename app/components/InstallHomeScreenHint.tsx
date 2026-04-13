'use client'

import { useState, useSyncExternalStore } from 'react'

type InstallHomeScreenHintProps = {
  role?: string | null
}

const DISMISS_KEY = 'trip-sheet-install-hint-dismissed'

function isStandaloneDisplay() {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  )
}

function isAndroidChrome() {
  if (typeof navigator === 'undefined') {
    return false
  }

  const userAgent = navigator.userAgent.toLowerCase()

  return (
    userAgent.includes('android') &&
    userAgent.includes('chrome') &&
    !userAgent.includes('edg') &&
    !userAgent.includes('opr')
  )
}

export default function InstallHomeScreenHint({
  role,
}: InstallHomeScreenHintProps) {
  const [isDismissed, setIsDismissed] = useState(false)
  const canShowHint = useSyncExternalStore(
    () => () => {},
    () => {
      if (role !== 'resource') {
        return false
      }

      if (isStandaloneDisplay() || !isAndroidChrome()) {
        return false
      }

      return window.localStorage.getItem(DISMISS_KEY) !== 'true'
    },
    () => false
  )

  if (!canShowHint || isDismissed || role !== 'resource') {
    return null
  }

  return (
    <section className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            For easier access, add this app to your home screen.
          </p>
          <p className="mt-1 text-sm text-gray-600">
            In Chrome, tap the menu and choose Add to Home screen.
          </p>
        </div>

        <button
          type="button"
          className="shrink-0 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-sm text-gray-700"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, 'true')
            setIsDismissed(true)
          }}
        >
          Dismiss
        </button>
      </div>
    </section>
  )
}
