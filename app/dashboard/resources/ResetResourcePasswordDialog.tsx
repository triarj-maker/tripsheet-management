'use client'

import { useId, useRef } from 'react'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { updateResourcePassword } from '@/app/dashboard/resources/actions'

type ResetResourcePasswordDialogProps = {
  resourceId: string
  fullName: string | null
  email: string | null
}

export default function ResetResourcePasswordDialog({
  resourceId,
  fullName,
  email,
}: ResetResourcePasswordDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const titleId = useId()
  const passwordId = useId()
  const confirmPasswordId = useId()
  const displayName = fullName?.trim()
  const displayEmail = email?.trim()
  const userLabel =
    displayName && displayEmail
      ? `${displayName} (${displayEmail})`
      : displayName || displayEmail || 'this user'

  return (
    <>
      <button
        type="button"
        className="ui-button ui-button-secondary"
        onClick={() => dialogRef.current?.showModal()}
      >
        Reset password
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 shadow-xl backdrop:bg-black/40"
        onClose={() => formRef.current?.reset()}
      >
        <form
          ref={formRef}
          action={updateResourcePassword}
          className="space-y-4 p-6"
        >
          <input type="hidden" name="id" value={resourceId} />
          <input type="hidden" name="return_to" value="resources" />

          <div>
            <h2
              id={titleId}
              className="break-words text-lg font-semibold text-gray-900"
            >
              Reset password for {userLabel}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              The user can sign in immediately with the new password.
            </p>
          </div>

          <div>
            <label htmlFor={passwordId} className="ui-label">
              New password
            </label>
            <input
              id={passwordId}
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              className="ui-input"
            />
          </div>

          <div>
            <label htmlFor={confirmPasswordId} className="ui-label">
              Confirm password
            </label>
            <input
              id={confirmPasswordId}
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              className="ui-input"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="ui-button ui-button-secondary"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <ActionSubmitButton
              idleLabel="Set password"
              pendingLabel="Updating…"
              className="ui-button-primary"
            />
          </div>
        </form>
      </dialog>
    </>
  )
}
