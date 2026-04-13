import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Trip Sheets',
    short_name: 'Trip Sheets',
    description: 'Open your assigned trip sheets and trips quickly from your home screen.',
    start_url: '/my-trips',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f4f5',
    theme_color: '#111827',
    icons: [
      {
        src: '/icons/trip-sheets-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/trip-sheets-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/trip-sheets-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
