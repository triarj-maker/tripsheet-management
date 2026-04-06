'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { dispatchPendingToast } from '@/app/lib/action-feedback'

import { sendTripNotification } from './trip-notifications'

type SendTripNotificationButtonProps = {
  tripId: string
  tripTitle: string
  recipientCount: number
}

type SendResultState = {
  tone: 'success' | 'error'
  message: string
}

export default function SendTripNotificationButton({
  tripId,
  tripTitle,
  recipientCount,
}: SendTripNotificationButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [result, setResult] = useState<SendResultState | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    if (isPending) {
      return
    }

    setIsOpen(false)
  }

  function handleConfirm() {
    startTransition(async () => {
      dispatchPendingToast('Sending notifications…')

      const actionResult = await sendTripNotification(tripId)
      const isSuccess = actionResult.ok || actionResult.recipientCount === 0

      setResult({
        tone: isSuccess ? 'success' : 'error',
        message: actionResult.message,
      })
      setIsOpen(false)

      if (actionResult.recipientCount > 0) {
        router.refresh()
      }
    })
  }

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          className="ui-button ui-button-primary"
          onClick={() => setIsOpen(true)}
          disabled={isPending}
        >
          {isPending ? 'Sending…' : 'Notify Resources'}
        </button>

        {result ? (
          <p
            className={`max-w-sm text-right text-sm ${
              result.tone === 'success' ? 'text-green-700' : 'text-red-600'
            }`}
          >
            {result.message}
          </p>
        ) : null}
      </div>

      {isOpen ? (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/30"
            onClick={handleClose}
          />

          <div
            aria-modal="true"
            role="dialog"
            aria-label="Send trip notification"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Notify Resources</p>
                <h2 className="text-lg font-semibold text-gray-900">{tripTitle}</h2>
                <p className="text-sm text-gray-700">
                  This will send one notification email to each unique assigned resource across
                  this trip&apos;s child trip sheets.
                </p>
                <p className="text-sm text-gray-600">
                  Unique recipients: {recipientCount}
                </p>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="ui-button ui-button-secondary"
                  onClick={handleClose}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ui-button ui-button-primary"
                  onClick={handleConfirm}
                  disabled={isPending}
                >
                  {isPending ? 'Sending…' : 'Send Notification'}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}
