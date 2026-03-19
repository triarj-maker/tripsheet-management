import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

function buildEmailLayout(content: string) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111; max-width: 520px;">
      ${content}
      <p style="margin-top: 24px;">– Echo Journeys</p>
    </div>
  `
}

export async function sendAssignmentEmail({
  to,
  resourceName,
  tripTitle,
  startDate,
  endDate,
  customer,
  tripId,
}: {
  to: string
  resourceName: string
  tripTitle: string
  startDate: string
  endDate?: string | null
  customer?: string | null
  tripId: string
}) {
  const url = `${process.env.APP_BASE_URL}/my-trip-sheets/${tripId}`

  return resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: `Assigned: ${tripTitle} (${startDate})`,
    html: buildEmailLayout(`
      <p style="margin-bottom: 8px;">Hi ${resourceName},</p>

      <p style="margin-bottom: 16px;">
        You’ve been <strong>assigned to a trip</strong>.
      </p>

      <div style="
        border: 1px solid #dbeafe;
        background-color: #eff6ff;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
      ">
        <p style="margin: 0; font-weight: 700; color: #1d4ed8;">
          Please review the trip sheet before the trip.
        </p>
        <p style="margin: 6px 0 0 0; color: #1e3a8a;">
          All trip details are maintained live on the app.
        </p>
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
          Open Trip Sheet
        </a>
      </div>

      <div style="
        border: 1px solid #eee;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
      ">
        <p style="margin: 4px 0;"><strong>Trip:</strong> ${tripTitle}</p>
        <p style="margin: 4px 0;"><strong>Start:</strong> ${startDate}</p>
        ${endDate ? `<p style="margin: 4px 0;"><strong>End:</strong> ${endDate}</p>` : ''}
        ${customer ? `<p style="margin: 4px 0;"><strong>Customer:</strong> ${customer}</p>` : ''}
      </div>

      <p style="font-size: 13px; color: #555;">
        Trip details may change. Always refer to the Trip Sheet for the latest updates.
      </p>

      <div style="margin-top: 16px;">
        <a 
          href="${url}" 
          style="color: #2563eb; text-decoration: none; font-weight: 500;"
        >
          → View latest trip details
        </a>
      </div>
    `),
  })
}

export async function sendReminderEmail({
  to,
  resourceName,
  tripTitle,
  startDate,
  endDate,
  customer,
  tripId,
}: {
  to: string
  resourceName: string
  tripTitle: string
  startDate: string
  endDate?: string | null
  customer?: string | null
  tripId: string
}) {
  const url = `${process.env.APP_BASE_URL}/my-trip-sheets/${tripId}`

  return resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: `Please Review: ${tripTitle} starts in 3 days`,
    html: buildEmailLayout(`
      <p style="margin-bottom: 8px;">Hi ${resourceName},</p>

      <div style="
        border: 1px solid #f59e0b;
        background-color: #fffbeb;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
      ">
        <p style="margin: 0; font-weight: 700; color: #92400e;">
          Your trip starts in 3 days.
        </p>
        <p style="margin: 6px 0 0 0; color: #78350f;">
          Please review the latest trip details now.
        </p>
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
          Review Trip Sheet
        </a>
      </div>

      <div style="
        border: 1px solid #eee;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
      ">
        <p style="margin: 4px 0;"><strong>Trip:</strong> ${tripTitle}</p>
        <p style="margin: 4px 0;"><strong>Start:</strong> ${startDate}</p>
        ${endDate ? `<p style="margin: 4px 0;"><strong>End:</strong> ${endDate}</p>` : ''}
        ${customer ? `<p style="margin: 4px 0;"><strong>Customer:</strong> ${customer}</p>` : ''}
      </div>

      <p style="font-size: 13px; color: #555;">
        Details may have changed. Please rely on the Trip Sheet for the most up-to-date information.
      </p>

      <div style="margin-top: 16px;">
        <a 
          href="${url}" 
          style="color: #2563eb; text-decoration: none; font-weight: 500;"
        >
          → Open latest trip sheet
        </a>
      </div>
    `),
  })
}