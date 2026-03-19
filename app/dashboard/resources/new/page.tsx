import Link from 'next/link'

import AdminNav from '@/app/dashboard/AdminNav'
import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { requireAdmin } from '@/app/dashboard/lib'

import { createResource } from '../actions'

type NewResourcePageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

export default async function NewResourcePage({
  searchParams,
}: NewResourcePageProps) {
  const params = await searchParams

  await requireAdmin()

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-12">
      <div className="mx-auto w-full max-w-[1600px] rounded-2xl bg-white p-8 shadow-sm">
        <AdminNav current="resources" />

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            Create Resource
          </h1>
        </div>

        {params.error ? (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {params.error}
          </p>
        ) : null}

        <form action={createResource} className="space-y-4">
          <div>
            <label
              htmlFor="full_name"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Full Name
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <ActionSubmitButton
              idleLabel="Save Resource"
              pendingLabel="Saving…"
              className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-gray-900"
            />
            <Link
              href="/dashboard/resources"
              className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-gray-900"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}
