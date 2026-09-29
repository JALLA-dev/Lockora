require('dotenv').config({ path: '.env.local' });
const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;
console.log('RESEND_API_KEY present:', Boolean(apiKey));
console.log('RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev');

const resend = new Resend(apiKey);

async function run() {
  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    to: 'delivered@resend.dev',
    subject: 'Lockora Security Alert — Protected Secret Accessed',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Lockora Security Alert</title></head>
<body style="font-family: sans-serif; background-color: #09090b; color: #f4f4f5; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 32px;">
    <h2 style="color: #6366f1;">Lockora Security Alert</h2>
    <p>A protected secret was accessed in your Lockora account.</p>
    <div style="background-color: #09090b; border: 1px solid #27272a; border-radius: 8px; padding: 20px;">
      <div><strong>Service:</strong> AWS Production</div>
      <div><strong>Action:</strong> Secret Revealed</div>
      <div><strong>Time:</strong> 28 September 2026, 15:30 UTC</div>
    </div>
    <p style="font-size: 13px; color: #a1a1aa; margin-top: 20px;">
      If you did not perform this action, review your Lockora security activity.
    </p>
  </div>
</body>
</html>`,
    text: `Lockora Security Alert — Protected Secret Accessed

A protected secret was accessed in your Lockora account.

Service:
AWS Production

Action:
Secret Revealed

Time:
28 September 2026, 15:30 UTC

If you did not perform this action, review your Lockora security activity.

Do not include the actual secret value.`,
  });

  console.log('Secret Reveal Email Delivery Result:', JSON.stringify(result, null, 2));
}

run();
