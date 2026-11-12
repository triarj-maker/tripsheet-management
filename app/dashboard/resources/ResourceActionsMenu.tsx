'use client'

import { useEffect, useId, useRef, useState } from 'react'

import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { toggleResourceActive } from './actions'
import ResetResourcePasswordDialog from './ResetResourcePasswordDialog'

type ResourceActionsMenuProps = {
  resourceId: string
  fullName: string | null
  email: string | null
  isActive: boolean | null
  canResetPassword: boolean
}

const itemClassName = 'w-full justify-start rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'

export default function ResourceActionsMenu({
  resourceId, fullName, email, isActive, canResetPassword,
}: ResourceActionsMenuProps) {
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open) return
    const close = () => {
      // Keep the existing password dialog open during viewport changes.
      if (!popoverRef.current?.querySelector('dialog[open]')) {
        popoverRef.current?.hidePopover()
      }
    }
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={id}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`More actions for ${fullName?.trim() || email?.trim() || resourceId}`}
        className="ui-button ui-button-secondary shrink-0"
        onClick={() => {
          const rect = triggerRef.current!.getBoundingClientRect()
          setPosition({
            top: window.innerHeight - rect.bottom >= 112
              ? rect.bottom + 4
              : Math.max(8, rect.top - 112),
            left: Math.max(8, Math.min(rect.right - 184, window.innerWidth - 192)),
          })
        }}
      >
        <span aria-hidden="true">⋮</span>
      </button>
      <div
        ref={popoverRef}
        id={id}
        popover="auto"
        aria-label="Resource actions"
        className="fixed m-0 w-[184px] rounded-xl border border-gray-200 bg-white p-1 text-gray-900 shadow-lg"
        style={{
          inset: 'auto',
          top: position.top,
          left: position.left,
          maxHeight: `calc(100dvh - ${position.top + 8}px)`,
          overflowY: 'auto',
        }}
        onToggle={(event) => {
          const isOpen = event.newState === 'open'
          setOpen(isOpen)
          if (isOpen) popoverRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
        }}
      >
        {canResetPassword ? (
          <ResetResourcePasswordDialog
            resourceId={resourceId}
            fullName={fullName}
            email={email}
            triggerClassName={itemClassName}
          />
        ) : null}
        <form action={toggleResourceActive}>
          <input type="hidden" name="id" value={resourceId} />
          <input type="hidden" name="next_is_active" value={isActive ? 'false' : 'true'} />
          <ActionSubmitButton
            idleLabel={isActive ? 'Deactivate' : 'Activate'}
            pendingLabel="Saving…"
            className={itemClassName}
          />
        </form>
      </div>
    </>
  )
}
