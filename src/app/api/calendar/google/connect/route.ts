import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GoogleCalendarProvider } from '@/lib/calendar/providers/GoogleCalendarProvider';
import crypto from 'crypto';

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/calendar/google/callback`;

  // CSRF state containing userId, timestamp, and nonce
  const nonce = crypto.randomBytes(16).toString('hex');
  const statePayload = JSON.stringify({ userId, nonce, ts: Date.now() });
  const state = Buffer.from(statePayload).toString('base64url');

  const provider = new GoogleCalendarProvider();
  const authUrl = provider.getAuthUrl(state, redirectUri);

  return NextResponse.redirect(authUrl);
}
