'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { startTransition } from 'react'

type SortSelectProps = {
  value: string
  compact?: boolean
}

export default function SortSelect({ value, compact = false }: SortSelectProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString())

    if (nextValue === 'created_desc') {
      params.delete('sort')
    } else {
      params.set('sort', nextValue)
    }

    const nextQuery = params.toString()

    startTransition(() => {
      router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname)
    })
  }

  return (
    <div>
      <label htmlFor="sort" className={compact ? 'ui-label-compact' : 'ui-label'}>
        Sort
      </label>
      <select
        id="sort"
        name="sort"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        className={compact ? 'ui-select ui-select-compact' : 'ui-select'}
      >
        <option value="created_desc">Created Time (newest first)</option>
        <option value="created_asc">Created Time (oldest first)</option>
        <option value="start_asc">Start Date (earliest first)</option>
        <option value="start_desc">Start Date (latest first)</option>
      </select>
    </div>
  )
}
