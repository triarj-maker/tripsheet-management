'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { startTransition } from 'react'

type ArchivedToggleProps = {
  checked: boolean
  className?: string
}

export default function ArchivedToggle({
  checked,
  className = '',
}: ArchivedToggleProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

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
    <label className={`inline-flex items-center gap-2 text-sm text-gray-700 ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => handleChange(event.target.checked)}
      />
      <span>Show Archived</span>
    </label>
  )
}
