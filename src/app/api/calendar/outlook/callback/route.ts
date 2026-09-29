import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { OutlookCalendarProvider } from '@/lib/calendar/providers/OutlookCalendarProvider';
import { db } from '@/db';
import { calendarConnections, auditLogs } from '@/db/schema';
import { encryptToken } from '@/lib/calendar/crypto';
import crypto from 'crypto';
import { ensureCalendarTablesExist } from '@/lib/calendar/db-init';

export async function GET(request: Request) {
  const { userId: currentUserId } = await auth();
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=missing_params`);
  }

  // Validate state
  let stateUserId = '';
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    stateUserId = decoded.userId;
    if (Date.now() - decoded.ts > 15 * 60 * 1000) {
      return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=state_expired`);
    }
  } catch {
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=invalid_state`);
  }

  const userId = currentUserId || stateUserId;
  if (!userId) {
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=unauthorized`);
  }

  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI || `${url.origin}/api/calendar/outlook/callback`;
  const provider = new OutlookCalendarProvider();

  if (!provider.isConfigured()) {
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=config_error`);
  }

  try {
    await ensureCalendarTablesExist();

    const tokens = await provider.exchangeCode(code, redirectUri);
    const encryptedAccess = encryptToken(tokens.accessToken);
    const encryptedRefresh = encryptToken(tokens.refreshToken);

    const connectionId = crypto.randomUUID();
    const timestamp = new Date();

    await db.insert(calendarConnections).values({
      id: connectionId,
      userId,
      provider: 'outlook',
      providerAccountId: tokens.providerAccountId,
      calendarId: 'primary',
      encryptedAccessToken: encryptedAccess,
      encryptedRefreshToken: encryptedRefresh,
      tokenExpiresAt: tokens.expiresAt,
      scopes: JSON.stringify(tokens.scopes),
      status: 'ACTIVE',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      userId,
      action: 'CALENDAR_CONNECTED',
      resource: 'OUTLOOK',
      result: 'SUCCESS',
      timestamp,
    });

    return NextResponse.redirect(`${url.origin}/dashboard/calendar?connected=outlook`);
  } catch (err: any) {
    console.error('[Outlook OAuth Callback Error]:', err?.message);
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=auth_failed`);
  }
}
