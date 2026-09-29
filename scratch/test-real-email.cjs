require('dotenv').config({ path: '.env.local' });
const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;
console.log('RESEND_API_KEY present:', Boolean(apiKey));
console.log('RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev');

const resend = new Resend(apiKey);

async function testRealEmail() {
  const targetEmail = process.argv[2] || 'test.user.lockora@gmail.com';
  console.log('Attempting delivery to real email address:', targetEmail);

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: targetEmail,
      subject: 'Lockora Security Alert — Protected Secret Accessed',
      html: '<p>A protected secret was accessed in your Lockora account.</p>',
      text: 'A protected secret was accessed in your Lockora account.',
    });

    console.log('Resend Delivery Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Resend Delivery Exception:', err.message);
  }
}

testRealEmail();
