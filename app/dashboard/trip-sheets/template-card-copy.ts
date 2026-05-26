import { requireAdmin } from './lib'

type DashboardSupabaseClient = Awaited<ReturnType<typeof requireAdmin>>['supabase']

type TemplateCardRow = {
  id: string
  template_id: string
  title: string | null
  category: string | null
  card_url: string | null
  sort_order: number | null
}

type TripSheetTemplateLink = {
  id: string
  templateId: string | null | undefined
}

function validateTemplateCard(card: TemplateCardRow) {
  const title = card.title?.trim() ?? ''
  const category = card.category?.trim() ?? ''
  const cardUrl = card.card_url?.trim() ?? ''

  if (!title) {
    return 'A template card is missing a title.'
  }

  if (category !== 'facilitator' && category !== 'expert') {
    return 'A template card has an invalid category.'
  }

  if (!cardUrl || !cardUrl.startsWith('/module-cards/')) {
    return 'A template card has an invalid card URL.'
  }

  return null
}

export async function copyTemplateCardsToTripSheets({
  supabase,
  tripSheets,
}: {
  supabase: DashboardSupabaseClient
  tripSheets: TripSheetTemplateLink[]
}) {
  const tripSheetsWithTemplates = tripSheets.filter(
    (tripSheet) => tripSheet.id && tripSheet.templateId
  )

  if (tripSheetsWithTemplates.length === 0) {
    return { error: null }
  }

  const templateIds = Array.from(
    new Set(
      tripSheetsWithTemplates
        .map((tripSheet) => tripSheet.templateId?.trim() ?? '')
        .filter(Boolean)
    )
  )

  if (templateIds.length === 0) {
    return { error: null }
  }

  const { data, error } = await supabase
    .from('template_cards')
    .select('id, template_id, title, category, card_url, sort_order')
    .in('template_id', templateIds)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    return { error }
  }

  const templateCards = (data as TemplateCardRow[] | null) ?? []

  if (templateCards.length === 0) {
    return { error: null }
  }

  for (const card of templateCards) {
    const validationError = validateTemplateCard(card)

    if (validationError) {
      return { error: new Error(validationError) }
    }
  }

  const cardsByTemplateId = new Map<string, TemplateCardRow[]>()

  for (const card of templateCards) {
    const currentCards = cardsByTemplateId.get(card.template_id) ?? []
    currentCards.push(card)
    cardsByTemplateId.set(card.template_id, currentCards)
  }

  const tripSheetCards = tripSheetsWithTemplates.flatMap((tripSheet) => {
    const templateCardsForTripSheet = cardsByTemplateId.get(tripSheet.templateId ?? '') ?? []

    return templateCardsForTripSheet.map((card) => ({
      trip_sheet_id: tripSheet.id,
      source_template_card_id: card.id,
      title: card.title?.trim() ?? '',
      category: card.category?.trim() ?? '',
      card_url: card.card_url?.trim() ?? '',
      sort_order: card.sort_order ?? 0,
    }))
  })

  if (tripSheetCards.length === 0) {
    return { error: null }
  }

  const { error: insertError } = await supabase
    .from('trip_sheet_cards')
    .insert(tripSheetCards)

  return { error: insertError }
}
