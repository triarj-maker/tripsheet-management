import ActionSubmitButton from '@/app/components/ActionSubmitButton'

import {
  createTemplateCard,
  deleteTemplateCard,
  updateTemplateCard,
} from './actions'

type TemplateCard = {
  id: string
  template_id: string
  title: string | null
  category: string | null
  card_url: string | null
  sort_order: number | null
}

type TemplateCardsSectionProps = {
  templateId: string
  cards: TemplateCard[]
}

function CategorySelect({
  id,
  defaultValue,
}: {
  id: string
  defaultValue?: string | null
}) {
  return (
    <select
      id={id}
      name="category"
      defaultValue={defaultValue === 'expert' ? 'expert' : 'facilitator'}
      required
      className="ui-select ui-select-compact"
    >
      <option value="facilitator">Facilitator</option>
      <option value="expert">Expert</option>
    </select>
  )
}

export default function TemplateCardsSection({
  templateId,
  cards,
}: TemplateCardsSectionProps) {
  return (
    <section className="app-section-card space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Module Cards</h2>
        <p className="mt-1 text-sm text-gray-600">
          Attach static playbook cards to this template. Store only relative URLs.
        </p>
      </div>

      <div className="space-y-3">
        {cards.length === 0 ? (
          <p className="text-sm text-gray-700">No module cards added yet.</p>
        ) : (
          cards.map((card) => {
            const titleId = `template_card_title_${card.id}`
            const categoryId = `template_card_category_${card.id}`
            const urlId = `template_card_url_${card.id}`
            const sortOrderId = `template_card_sort_order_${card.id}`

            return (
              <div key={card.id} className="rounded-lg border border-zinc-200 px-3 py-3">
                <form action={updateTemplateCard} className="space-y-3">
                  <input type="hidden" name="id" value={card.id} />
                  <input type="hidden" name="template_id" value={templateId} />

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_8rem]">
                    <div>
                      <label htmlFor={titleId} className="ui-label">
                        Title
                      </label>
                      <input
                        id={titleId}
                        name="title"
                        type="text"
                        defaultValue={card.title ?? ''}
                        required
                        className="ui-input ui-input-compact"
                      />
                    </div>

                    <div>
                      <label htmlFor={categoryId} className="ui-label">
                        Category
                      </label>
                      <CategorySelect id={categoryId} defaultValue={card.category} />
                    </div>

                    <div>
                      <label htmlFor={sortOrderId} className="ui-label">
                        Sort Order
                      </label>
                      <input
                        id={sortOrderId}
                        name="sort_order"
                        type="number"
                        step={1}
                        defaultValue={card.sort_order ?? 0}
                        className="ui-input ui-input-compact"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor={urlId} className="ui-label">
                      Card URL
                    </label>
                    <input
                      id={urlId}
                      name="card_url"
                      type="text"
                      defaultValue={card.card_url ?? ''}
                      required
                      className="ui-input ui-input-compact"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Use a relative URL such as /module-cards/hampi/mock-excavation-facilitator.html
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <ActionSubmitButton
                      idleLabel="Save Card"
                      pendingLabel="Saving..."
                      className="ui-button-primary ui-button-compact"
                    />
                  </div>
                </form>

                <form action={deleteTemplateCard} className="mt-2">
                  <input type="hidden" name="id" value={card.id} />
                  <input type="hidden" name="template_id" value={templateId} />
                  <ActionSubmitButton
                    idleLabel="Delete Card"
                    pendingLabel="Deleting..."
                    className="ui-button-danger ui-button-compact"
                  />
                </form>
              </div>
            )
          })
        )}
      </div>

      <form action={createTemplateCard} className="rounded-lg border border-dashed border-zinc-300 px-3 py-3">
        <input type="hidden" name="template_id" value={templateId} />

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_8rem]">
          <div>
            <label htmlFor="new_template_card_title" className="ui-label">
              Title
            </label>
            <input
              id="new_template_card_title"
              name="title"
              type="text"
              required
              className="ui-input ui-input-compact"
            />
          </div>

          <div>
            <label htmlFor="new_template_card_category" className="ui-label">
              Category
            </label>
            <CategorySelect id="new_template_card_category" />
          </div>

          <div>
            <label htmlFor="new_template_card_sort_order" className="ui-label">
              Sort Order
            </label>
            <input
              id="new_template_card_sort_order"
              name="sort_order"
              type="number"
              step={1}
              defaultValue={0}
              className="ui-input ui-input-compact"
            />
          </div>
        </div>

        <div className="mt-3">
          <label htmlFor="new_template_card_url" className="ui-label">
            Card URL
          </label>
          <input
            id="new_template_card_url"
            name="card_url"
            type="text"
            required
            placeholder="/module-cards/hampi/mock-excavation-facilitator.html"
            className="ui-input ui-input-compact"
          />
          <p className="mt-1 text-xs text-gray-500">
            Use a relative URL such as /module-cards/hampi/mock-excavation-facilitator.html
          </p>
        </div>

        <div className="mt-3">
          <ActionSubmitButton
            idleLabel="Add Card"
            pendingLabel="Adding..."
            className="ui-button-secondary ui-button-compact"
          />
        </div>
      </form>
    </section>
  )
}
