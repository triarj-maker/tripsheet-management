'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { startTransition } from 'react'

type FilterOption = {
  label: string
  value: string
}

type FilterSelectProps = {
  id: string
  label: string
  value: string
  options: FilterOption[]
  defaultValue?: string
}

export default function FilterSelect({
  id,
  label,
  value,
  options,
  defaultValue = '',
}: FilterSelectProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString())

    if (!nextValue || nextValue === defaultValue) {
      params.delete(id)
    } else {
      params.set(id, nextValue)
    }

    const nextQuery = params.toString()

    startTransition(() => {
      router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname)
    })
  }

  return (
    <div>
      <label htmlFor={id} className="ui-label-compact">
        {label}
      </label>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        className="ui-select ui-select-compact"
      >
        {options.map((option) => (
          <option key={option.value || 'default'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
