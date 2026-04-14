'use client'

import { useState } from 'react'

type CopyCalendarLinkButtonProps = {
  url: string
}

export default function CopyCalendarLinkButton({
  url,
}: CopyCalendarLinkButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="ui-button ui-button-secondary min-h-10"
          onClick={handleCopy}
        >
          Copy Calendar Link
        </button>

        <a
          href="https://calendar.google.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-10 items-center text-sm font-medium text-gray-600 underline decoration-transparent underline-offset-2 transition hover:text-gray-900 hover:decoration-zinc-300"
        >
          Open Google Calendar
        </a>
      </div>

      <p
        className={`text-sm ${copied ? 'text-green-700' : 'text-gray-600'}`}
        aria-live="polite"
      >
        {copied
          ? 'Calendar link copied.'
          : 'Sync your trip sheets with Google Calendar.'}
      </p>
    </div>
  )
}
