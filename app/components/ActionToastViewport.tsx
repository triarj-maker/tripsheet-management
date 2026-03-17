'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  getToastMessage,
  pendingToastEventName,
  toastQueryParam,
} from '@/app/lib/action-feedback'

type ToastState = {
  tone: 'pending' | 'success'
  message: string
}

export default function ActionToastViewport() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    function handlePendingToast(event: Event) {
      const customEvent = event as CustomEvent<{ message?: string }>
      const message = customEvent.detail?.message?.trim()

      if (!message) {
        return
      }

      setToast({
        tone: 'pending',
        message,
      })
    }

    window.addEventListener(pendingToastEventName, handlePendingToast)

    return () => {
      window.removeEventListener(pendingToastEventName, handlePendingToast)
    }
  }, [])

  useEffect(() => {
    const error = searchParams.get('error')
    const toastValue = searchParams.get(toastQueryParam)
    let frameId: number | null = null

    if (error) {
      frameId = window.requestAnimationFrame(() => {
        setToast(null)
      })

      return () => {
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId)
        }
      }
    }

    if (!toastValue) {
      return
    }

    const message = getToastMessage(toastValue)

    if (message) {
      frameId = window.requestAnimationFrame(() => {
        setToast({
          tone: 'success',
          message,
        })
      })
    }

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete(toastQueryParam)

    const nextSearch = nextParams.toString()
    router.replace(`${pathname}${nextSearch ? `?${nextSearch}` : ''}`, {
      scroll: false,
    })

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [pathname, router, searchParams])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeout = window.setTimeout(
      () => setToast(null),
      toast.tone === 'pending' ? 10000 : 2000
    )

    return () => {
      window.clearTimeout(timeout)
    }
  }, [toast])

  if (!toast) {
    return null
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50">
      <div
        className={[
          'rounded-lg px-4 py-2 text-sm font-medium shadow-lg',
          toast.tone === 'pending'
            ? 'bg-gray-900 text-white'
            : 'bg-green-600 text-white',
        ].join(' ')}
      >
        {toast.message}
      </div>
    </div>
  )
}
