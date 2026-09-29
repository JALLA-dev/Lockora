require('dotenv').config({ path: '.env.local' });
const { Resend } = require('resend');

async function testResend() {
  const apiKey = process.env.RESEND_API_KEY;
  const hasKey = Boolean(apiKey && apiKey.trim().length > 0);
  console.log('RESEND_API_KEY present:', hasKey);
  console.log('RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev');

  if (!hasKey) {
    console.error('ERROR: RESEND_API_KEY is not defined in environment!');
    return;
  }

  const resend = new Resend(apiKey.trim());

  try {
    const res = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: 'delivered@resend.dev',
      subject: 'Lockora Resend Test',
      html: '<p>Lockora email service is working.</p>',
      text: 'Lockora email service is working.',
    });

    console.log('Resend Response Result:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Resend Exception:', err.message);
  }
}

testResend();
