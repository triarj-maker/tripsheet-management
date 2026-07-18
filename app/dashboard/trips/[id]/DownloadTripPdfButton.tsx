'use client'

import { useState } from 'react'

type DownloadTripPdfButtonProps = {
  tripId: string
}

export default function DownloadTripPdfButton({ tripId }: DownloadTripPdfButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [includeResources, setIncludeResources] = useState(false)

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
        type="button"
        className="ui-button ui-button-secondary"
        onClick={() => setIsOpen(true)}
      >
        Download PDF
      </button>

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
            aria-label="Download PDF"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
          </div>
        </>
      ) : null}
    </>
  )
}
