'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { startTransition, useEffect, useState } from 'react'

type ArchivedToggleProps = {
  checked: boolean
  className?: string
  compact?: boolean
  label?: string
}

export default function ArchivedToggle({
  checked,
  className = '',
  compact = false,
  label = 'Archived',
}: ArchivedToggleProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [showArchived, setShowArchived] = useState(checked)

  useEffect(() => {
    setShowArchived(checked)
  }, [checked])

  function handleChange(nextChecked: boolean) {
    const params = new URLSearchParams(searchParams.toString())

    if (nextChecked) {
      params.set('showArchived', 'true')
    } else {
      params.delete('showArchived')
    }

    const nextQuery = params.toString()

    startTransition(() => {
      router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname)
    })
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className={compact ? 'text-xs font-medium text-gray-600' : 'text-sm font-medium text-gray-600'}>
        {label}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={showArchived}
        onClick={() => {
          const nextChecked = !showArchived
          setShowArchived(nextChecked)
          handleChange(nextChecked)
        }}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${
          showArchived ? 'bg-black' : 'bg-zinc-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
            showArchived ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
