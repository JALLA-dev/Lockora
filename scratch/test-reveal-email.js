require('dotenv').config({ path: '.env.local' });
const { emailService } = require('../src/lib/email');

async function testRevealEmail() {
  const recipient = process.argv[2] || 'delivered@resend.dev';
  console.log('Testing sendSecurityAlert to recipient:', recipient);

  const result = await emailService.sendSecurityAlert({
    to: recipient,
    event: 'SECRET_REVEALED',
    serviceName: 'AWS Production',
    actionName: 'Secret Revealed',
    time: new Date(),
  });

  console.log('Result:', JSON.stringify(result, null, 2));
}

testRevealEmail();
