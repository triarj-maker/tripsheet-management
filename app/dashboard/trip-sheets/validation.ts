export const guestOrCompanyRequiredMessage =
  'Either Guest / School Name or Company is required'

export function hasGuestOrCompany(guestName: string, company: string) {
  return Boolean(guestName.trim() || company.trim())
}
