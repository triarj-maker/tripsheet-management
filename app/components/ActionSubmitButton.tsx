'use client'

import { useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'

import { dispatchPendingToast } from '@/app/lib/action-feedback'

type ActionSubmitButtonProps = {
  idleLabel: string
  pendingLabel: string
  className?: string
  disabled?: boolean
  name?: string
  value?: string
}

export default function ActionSubmitButton({
  idleLabel,
  pendingLabel,
  className = 'ui-button-secondary',
  disabled = false,
  name,
  value,
}: ActionSubmitButtonProps) {
  const { pending } = useFormStatus()
  const previousPending = useRef(false)

  useEffect(() => {
    if (pending && !previousPending.current) {
      dispatchPendingToast(pendingLabel)
    }

    previousPending.current = pending
  }, [pending, pendingLabel])

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      className={`ui-button ${className}`}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  )
}
