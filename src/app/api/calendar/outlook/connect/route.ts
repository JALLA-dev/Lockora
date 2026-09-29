import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { OutlookCalendarProvider } from '@/lib/calendar/providers/OutlookCalendarProvider';
import crypto from 'crypto';

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI || `${url.origin}/api/calendar/outlook/callback`;

  const nonce = crypto.randomBytes(16).toString('hex');
  const statePayload = JSON.stringify({ userId, nonce, ts: Date.now() });
  const state = Buffer.from(statePayload).toString('base64url');

  const provider = new OutlookCalendarProvider();
  if (!provider.isConfigured()) {
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=config_error`);
  }

  try {
    const authUrl = provider.getAuthUrl(state, redirectUri);
    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=config_error`);
  }
}
