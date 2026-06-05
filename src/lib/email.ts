/**
 * Email utility — powered by Resend (https://resend.com)
 *
 * Uses the Resend REST API directly with fetch — no SDK needed.
 * Set RESEND_API_KEY and RESEND_FROM_EMAIL in your env vars.
 *
 * If RESEND_API_KEY is not set, emails are logged to console only
 * (graceful degradation for local dev).
 *
 * Setup:
 *   1. Sign up at resend.com (free tier: 3,000 emails/month)
 *   2. Add and verify your sending domain
 *   3. Create an API key and add it to your env vars
 */

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? 'ProofLink <noreply@prooflink.app>';

  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY not set — would have sent:`, payload.subject, '→', payload.to);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[email] Resend error:', err);
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

export async function sendPaymentReceivedToFreelancer(opts: {
  freelancerEmail: string;
  projectTitle: string;
  amount: number;
  projectId: string;
}) {
  await sendEmail({
    to: opts.freelancerEmail,
    subject: `Payment received for "${opts.projectTitle}"`,
    html: `
      <h2>Payment Received</h2>
      <p>Your client has paid <strong>₹${opts.amount}</strong> for <strong>${opts.projectTitle}</strong>.</p>
      <p>Funds are held for 24 hours. If no dispute is raised, they will be automatically released to you.</p>
      <p>Drop ID: <code>${opts.projectId}</code></p>
    `,
  });
}

export async function sendPaymentConfirmationToBuyer(opts: {
  buyerEmail: string;
  projectTitle: string;
  amount: number;
  projectId: string;
  downloadToken: string;
}) {
  const downloadUrl = `${process.env.NEXT_PUBLIC_APP_URL}/p/${opts.projectId}`;
  await sendEmail({
    to: opts.buyerEmail,
    subject: `Your file is unlocked — "${opts.projectTitle}"`,
    html: `
      <h2>Payment Confirmed</h2>
      <p>Your payment of <strong>₹${opts.amount}</strong> for <strong>${opts.projectTitle}</strong> was successful.</p>
      <p>Your final file is now unlocked. Download it here:</p>
      <p><a href="${downloadUrl}">${downloadUrl}</a></p>
      <p>You have 24 hours to raise a dispute if there's an issue with the delivery.</p>
      <p>Drop ID: <code>${opts.projectId}</code></p>
    `,
  });
}

export async function sendDisputeOpenedToFreelancer(opts: {
  freelancerEmail: string;
  projectTitle: string;
  projectId: string;
  reason: string;
}) {
  await sendEmail({
    to: opts.freelancerEmail,
    subject: `Dispute opened on "${opts.projectTitle}"`,
    html: `
      <h2>Dispute Opened</h2>
      <p>Your client has opened a dispute on <strong>${opts.projectTitle}</strong>.</p>
      <p><strong>Reason:</strong> ${opts.reason}</p>
      <p>Funds are frozen until the dispute is resolved. Please review and respond.</p>
      <p>Drop ID: <code>${opts.projectId}</code></p>
    `,
  });
}

export async function sendFundsReleasedToFreelancer(opts: {
  freelancerEmail: string;
  projectTitle: string;
  amount: number;
  projectId: string;
}) {
  await sendEmail({
    to: opts.freelancerEmail,
    subject: `Funds released for "${opts.projectTitle}"`,
    html: `
      <h2>Funds Released</h2>
      <p>The 24-hour hold period has passed with no dispute. <strong>₹${opts.amount}</strong> for <strong>${opts.projectTitle}</strong> has been released.</p>
      <p>Drop ID: <code>${opts.projectId}</code></p>
    `,
  });
}

export async function sendDisputeResolvedToParties(opts: {
  freelancerEmail: string;
  buyerEmail: string;
  projectTitle: string;
  projectId: string;
  outcome: 'released' | 'refunded';
}) {
  const outcomeText = opts.outcome === 'released'
    ? 'The dispute has been resolved in favour of the freelancer. Funds have been released.'
    : 'The dispute has been resolved in favour of the buyer. A refund will be processed.';

  await Promise.all([
    sendEmail({
      to: opts.freelancerEmail,
      subject: `Dispute resolved — "${opts.projectTitle}"`,
      html: `<h2>Dispute Resolved</h2><p>${outcomeText}</p><p>Drop ID: <code>${opts.projectId}</code></p>`,
    }),
    sendEmail({
      to: opts.buyerEmail,
      subject: `Dispute resolved — "${opts.projectTitle}"`,
      html: `<h2>Dispute Resolved</h2><p>${outcomeText}</p><p>Drop ID: <code>${opts.projectId}</code></p>`,
    }),
  ]);
}
