export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <main className="app-page">
      <div className="app-shell app-card">{children}</div>
    </main>
  )
}
