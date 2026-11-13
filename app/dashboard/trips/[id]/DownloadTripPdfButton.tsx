'use client'

import { useEffect, useRef, useState } from 'react'

type DownloadTripPdfButtonProps = {
  tripId: string
}

export default function DownloadTripPdfButton({ tripId }: DownloadTripPdfButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [includeResources, setIncludeResources] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const dialog = dialogRef.current
    const trigger = triggerRef.current
    dialog?.showModal()
    return () => {
      dialog?.close()
      trigger?.focus()
    }
  }, [isOpen])

  const handleClose = () => {
    setIsOpen(false)
    setIncludeResources(false)
  }

  const handleDownload = () => {
    const params = new URLSearchParams()

    if (includeResources) {
      params.set('includeResources', 'true')
    }

    const queryString = params.toString()
    window.location.href = `/dashboard/trips/${tripId}/pdf${queryString ? `?${queryString}` : ''}`
    handleClose()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="ui-button ui-button-secondary"
        onClick={() => setIsOpen(true)}
      >
        Download PDF
      </button>

      {isOpen ? (
        <dialog
          ref={dialogRef}
          aria-label="Download PDF"
          onCancel={handleClose}
          onClose={handleClose}
          onClick={event => { if (event.target === event.currentTarget) handleClose() }}
          className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border-0 bg-transparent p-0 backdrop:bg-black/30"
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Download PDF</p>
              <h2 className="text-lg font-semibold text-gray-900">Trip Itinerary</h2>
              <label className="mt-4 flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={includeResources}
                  onChange={(event) => setIncludeResources(event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <span>Include guide / coordinator details</span>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="ui-button ui-button-secondary"
                onClick={handleClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ui-button ui-button-primary"
                onClick={handleDownload}
              >
                Download PDF
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  )
}
