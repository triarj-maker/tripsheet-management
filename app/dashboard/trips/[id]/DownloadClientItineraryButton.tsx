'use client'

import { useState } from 'react'

type DownloadClientItineraryButtonProps = {
  tripId: string
}

export default function DownloadClientItineraryButton({
  tripId,
}: DownloadClientItineraryButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  function handleDownload() {
    setIsDownloading(true)
    window.location.href = `/dashboard/trips/${tripId}/client-itinerary/pdf`

    window.setTimeout(() => {
      setIsDownloading(false)
    }, 1500)
  }

  return (
    <button
      type="button"
      className="ui-button ui-button-secondary"
      onClick={handleDownload}
      disabled={isDownloading}
    >
      {isDownloading ? 'Preparing...' : 'Download Client Itinerary'}
    </button>
  )
}
