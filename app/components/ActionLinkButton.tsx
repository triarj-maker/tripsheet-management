'use client'

import { startTransition, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  appendToastParam,
  dispatchPendingToast,
} from '@/app/lib/action-feedback'

type ActionLinkButtonProps = {
  href: string
  idleLabel: string
  pendingLabel: string
  className: string
}

export default function ActionLinkButton({
  href,
  idleLabel,
  pendingLabel,
  className,
}: ActionLinkButtonProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  function handleClick() {
    if (isPending) {
      return
    }

    setIsPending(true)
    dispatchPendingToast(pendingLabel)

    startTransition(() => {
      router.push(appendToastParam(href))
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-70`}
    >
      {isPending ? pendingLabel : idleLabel}
    </button>
  )
}
