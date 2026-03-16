'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { startTransition } from 'react'

type SortSelectProps = {
  value: string
}

export default function SortSelect({ value }: SortSelectProps) {
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
      <label htmlFor="sort" className="mb-1 block text-sm font-medium text-gray-700">
        Sort By
      </label>
      <select
        id="sort"
        name="sort"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900"
      >
        <option value="created_desc">Created Time (newest first)</option>
        <option value="created_asc">Created Time (oldest first)</option>
        <option value="start_asc">Start Date (earliest first)</option>
        <option value="start_desc">Start Date (latest first)</option>
      </select>
    </div>
  )
}
