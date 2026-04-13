import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Suspense } from 'react'

import ActionToastViewport from './components/ActionToastViewport'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Trip Sheet Mgmt',
  description: 'Trip Sheet Management System',
  applicationName: 'Trip Sheets',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/trip-sheets-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/trip-sheets-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/trip-sheets-192.png', sizes: '192x192', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Trip Sheets',
  },
}

export const viewport: Viewport = {
  themeColor: '#111827',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Suspense fallback={null}>
          <ActionToastViewport />
        </Suspense>
      </body>
    </html>
  )
}
