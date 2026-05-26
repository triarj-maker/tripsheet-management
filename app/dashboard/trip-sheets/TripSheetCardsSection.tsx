import ActionSubmitButton from '@/app/components/ActionSubmitButton'

import {
  createTripSheetCard,
  deleteTripSheetCard,
  updateTripSheetCard,
} from './actions'

type TripSheetCard = {
  id: string
  trip_sheet_id: string
  source_template_card_id: string | null
  title: string | null
  category: string | null
  card_url: string | null
  sort_order: number | null
}

type TripSheetCardsSectionProps = {
  tripSheetId: string
  cards: TripSheetCard[]
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

export default function TripSheetCardsSection({
  tripSheetId,
  cards,
}: TripSheetCardsSectionProps) {
  return (
    <section className="app-section-card space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Module Cards</h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage the playbook cards attached to this trip sheet.
        </p>
      </div>

      <div className="space-y-3">
        {cards.length === 0 ? (
          <p className="text-sm text-gray-700">No module cards added yet.</p>
        ) : (
          cards.map((card) => {
            const titleId = `trip_sheet_card_title_${card.id}`
            const categoryId = `trip_sheet_card_category_${card.id}`
            const urlId = `trip_sheet_card_url_${card.id}`
            const sortOrderId = `trip_sheet_card_sort_order_${card.id}`

            return (
              <div key={card.id} className="rounded-lg border border-zinc-200 px-3 py-3">
                <form action={updateTripSheetCard} className="space-y-3">
                  <input type="hidden" name="id" value={card.id} />
                  <input type="hidden" name="trip_sheet_id" value={tripSheetId} />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {card.source_template_card_id ? (
                      <p className="text-xs font-medium text-gray-500">
                        Copied from template
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-gray-500">One-off card</p>
                    )}
                  </div>

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

                <form action={deleteTripSheetCard} className="mt-2">
                  <input type="hidden" name="id" value={card.id} />
                  <input type="hidden" name="trip_sheet_id" value={tripSheetId} />
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

      <form action={createTripSheetCard} className="rounded-lg border border-dashed border-zinc-300 px-3 py-3">
        <input type="hidden" name="trip_sheet_id" value={tripSheetId} />

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_8rem]">
          <div>
            <label htmlFor="new_trip_sheet_card_title" className="ui-label">
              Title
            </label>
            <input
              id="new_trip_sheet_card_title"
              name="title"
              type="text"
              required
              className="ui-input ui-input-compact"
            />
          </div>

          <div>
            <label htmlFor="new_trip_sheet_card_category" className="ui-label">
              Category
            </label>
            <CategorySelect id="new_trip_sheet_card_category" />
          </div>

          <div>
            <label htmlFor="new_trip_sheet_card_sort_order" className="ui-label">
              Sort Order
            </label>
            <input
              id="new_trip_sheet_card_sort_order"
              name="sort_order"
              type="number"
              step={1}
              defaultValue={0}
              className="ui-input ui-input-compact"
            />
          </div>
        </div>

        <div className="mt-3">
          <label htmlFor="new_trip_sheet_card_url" className="ui-label">
            Card URL
          </label>
          <input
            id="new_trip_sheet_card_url"
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
