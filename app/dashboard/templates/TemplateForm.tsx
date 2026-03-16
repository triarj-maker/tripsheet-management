type TemplateFormProps = {
  action: (formData: FormData) => void | Promise<void>
  submitLabel: string
  initialTitle?: string
  initialBody?: string
  templateId?: string
}

export default function TemplateForm({
  action,
  submitLabel,
  initialTitle = '',
  initialBody = '',
  templateId,
}: TemplateFormProps) {
  return (
    <form action={action} className="space-y-4">
      {templateId ? <input type="hidden" name="id" value={templateId} /> : null}

      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          defaultValue={initialTitle}
          required
          maxLength={30}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div>
        <label htmlFor="body" className="mb-1 block text-sm font-medium text-gray-700">
          Body
        </label>
        <textarea
          id="body"
          name="body"
          rows={14}
          defaultValue={initialBody}
          required
          maxLength={3000}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <button
        type="submit"
        className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-gray-900"
      >
        {submitLabel}
      </button>
    </form>
  )
}
