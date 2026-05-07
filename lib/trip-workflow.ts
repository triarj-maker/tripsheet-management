export type TripWorkflowState = 'tentative' | 'active'
export type VisibleTripState = 'tentative' | 'active' | 'completed' | 'archived'

export function normalizeTripWorkflowState(value: string | null | undefined): TripWorkflowState {
  return value === 'tentative' ? 'tentative' : 'active'
}

export function getVisibleTripState({
  workflowState,
  isArchived,
  endDate,
  today,
}: {
  workflowState: string | null | undefined
  isArchived: boolean
  endDate: string | null
  today: string
}): VisibleTripState {
  if (isArchived) {
    return 'archived'
  }

  if (endDate && today > endDate) {
    return 'completed'
  }

  return normalizeTripWorkflowState(workflowState)
}

export function formatVisibleTripStateLabel(state: VisibleTripState) {
  if (state === 'tentative') {
    return 'Tentative'
  }

  if (state === 'active') {
    return 'Active'
  }

  if (state === 'completed') {
    return 'Completed'
  }

  return 'Archived'
}

export function isTripNotificationAllowed(state: VisibleTripState) {
  return state === 'active'
}
