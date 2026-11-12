'use client'

import { useEffect, useId, useRef, useState } from 'react'
import ActionLinkButton from '@/app/components/ActionLinkButton'
import ActionSubmitButton from '@/app/components/ActionSubmitButton'
import { archiveTemplate, restoreTemplate } from './actions'
import DeleteTemplateButton from './DeleteTemplateButton'

const itemClass = 'w-full justify-start rounded-lg border-transparent px-3 py-2 text-left hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-emerald-700'

export default function TemplateActionsMenu({ templateId, title, archived, returnTo }: {
  templateId: string
  title: string
  archived: boolean
  returnTo: string
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const popover = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  useEffect(() => {
    if (!open) return
    const close = (event: Event) => {
      // Allow scrolling the menu itself on very short mobile viewports.
      if (event.target instanceof Node && popover.current?.contains(event.target)) return
      popover.current?.hidePopover()
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
      <button ref={trigger} type="button" popoverTarget={id}
        aria-expanded={open} aria-controls={id} aria-label={`More actions for ${title}`}
        className="ui-button ui-button-secondary shrink-0"
        onClick={() => {
          const rect = trigger.current!.getBoundingClientRect()
          const height = Math.min(156, window.innerHeight - 16)
          setPosition({
            top: Math.max(8, window.innerHeight - rect.bottom >= height + 4 ? rect.bottom + 4 : rect.top - height - 4),
            left: Math.max(8, Math.min(rect.right - 184, window.innerWidth - 192)),
          })
        }}>
        <span aria-hidden="true">⋮</span>
      </button>
      <div id={id} ref={popover} popover="auto" aria-label={`Actions for ${title}`}
        className="fixed m-0 w-[184px] max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 text-gray-900 shadow-lg"
        style={{ inset: 'auto', top: position.top, left: position.left, maxHeight: `calc(100dvh - ${position.top + 8}px)` }}
        onToggle={event => {
          const isOpen = event.newState === 'open'
          setOpen(isOpen)
          if (isOpen) popover.current?.querySelector<HTMLButtonElement>('button')?.focus()
        }}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault()
            popover.current?.hidePopover()
            trigger.current?.focus()
          }
        }}>
        <ActionLinkButton href={`/dashboard/templates/new?duplicateFrom=${templateId}`}
          idleLabel="Duplicate" pendingLabel="Duplicating…" className={itemClass} />
        <form action={archived ? restoreTemplate : archiveTemplate}>
          <input type="hidden" name="id" value={templateId} />
          <input type="hidden" name="return_to" value={returnTo} />
          <ActionSubmitButton idleLabel={archived ? 'Restore' : 'Archive'}
            pendingLabel={archived ? 'Restoring…' : 'Archiving…'} className={itemClass} />
        </form>
        <DeleteTemplateButton templateId={templateId} returnTo={returnTo} className={`${itemClass} text-red-700`} />
      </div>
    </>
  )
}
