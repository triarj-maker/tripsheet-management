import { Resend } from 'resend'

export function createResendClient() {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured.')
  }

  return new Resend(apiKey)
}

export function buildEmailLayout(content: string) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111; max-width: 520px;">
      ${content}
      <p style="margin-top: 24px;">– Echo Journeys</p>
    </div>
  `
}

type TripNotificationTripSheetSummary = {
  title: string
  startDate: string
  startTime?: string | null
  endDate?: string | null
  endTime?: string | null
}

function formatDisplayDate(value: string) {
  const parsedDate = new Date(`${value}T00:00:00`)

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate)
}

function formatDisplayTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  const parsedDate = new Date()
  parsedDate.setHours(hours || 0, minutes || 0, 0, 0)

  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(parsedDate)
}

function formatTripSheetSchedule({
  startDate,
  startTime,
  endDate,
  endTime,
}: TripNotificationTripSheetSummary) {
  const startParts = [formatDisplayDate(startDate)]

  if (startTime) {
    startParts.push(formatDisplayTime(startTime))
  }

  const endParts = [formatDisplayDate(endDate || startDate)]

  if (endTime) {
    endParts.push(formatDisplayTime(endTime))
  }

  return `${startParts.join(', ')} -> ${endParts.join(', ')}`
}

export async function sendTripNotificationEmail({
  to,
  resourceName,
  tripId,
  tripTitle,
  tripStartDate,
  tripEndDate,
  destination,
  tripSheets,
}: {
  to: string
  resourceName: string
  tripId: string
  tripTitle: string
  tripStartDate: string
  tripEndDate: string
  destination?: string | null
  tripSheets: TripNotificationTripSheetSummary[]
}) {
  const resend = createResendClient()
  const url = `${process.env.APP_BASE_URL}/trips/${tripId}`
  const subject = `Trip details: ${tripTitle}`
  const tripSheetList = tripSheets
    .map(
      (tripSheet) => `
        <li style="margin-bottom: 12px;">
          <div style="font-weight: 600; color: #111827;">${tripSheet.title}</div>
          <div style="color: #4b5563; font-size: 13px;">${formatTripSheetSchedule(tripSheet)}</div>
        </li>
      `
    )
    .join('')

  const html = buildEmailLayout(`
      <p style="margin-bottom: 8px;">Hi ${resourceName},</p>

      <p style="margin-bottom: 16px;">
        Here are your current assigned trip sheets for this trip.
      </p>

      <div style="
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
      ">
        <p style="margin: 4px 0;"><strong>Trip:</strong> ${tripTitle}</p>
        <p style="margin: 4px 0;"><strong>Destination:</strong> ${destination || 'TBD'}</p>
        <p style="margin: 4px 0;"><strong>Trip dates:</strong> ${formatDisplayDate(tripStartDate)} to ${formatDisplayDate(tripEndDate)}</p>
      </div>

      <div style="
        border: 1px solid #eef2f7;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 18px;
        background-color: #fafcff;
      ">
        <p style="margin: 0; font-weight: 700; color: #111827;">Assigned trip sheets</p>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #4b5563;">
          The app remains the source of truth for the latest live trip details.
        </p>
      </div>

      <div style="margin-bottom: 18px;">
        <ul style="padding-left: 18px; margin: 0;">
          ${tripSheetList}
        </ul>
      </div>

      <div style="margin-bottom: 20px;">
        <a
          href="${url}"
          style="
            display: inline-block;
            padding: 12px 18px;
            background-color: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
          "
        >
          Open Trip in App
        </a>
      </div>

      <p style="font-size: 13px; color: #555;">
        Please rely on the app for the most up-to-date timings, assignments, and edits.
      </p>
    `)

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject,
    html,
  })

  return {
    subject,
  }
}
