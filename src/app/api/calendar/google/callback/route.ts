import { NextResponse } from 'next/server';
import { GoogleCalendarProvider } from '@/lib/calendar/providers/GoogleCalendarProvider';
import { db } from '@/db';
import { calendarConnections, oauthStates, auditLogs } from '@/db/schema';
import { encryptToken } from '@/lib/calendar/crypto';
import crypto from 'crypto';
import { eq, and, lt } from 'drizzle-orm';
import { ensureCalendarTablesExist } from '@/lib/calendar/db-init';

/**
 * Handles the Google OAuth callback after the user grants calendar access.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  // Handle Google returning an error (e.g. user declined consent)
  if (errorParam) {
    console.error(`[Google OAuth] Google returned error: ${errorParam}`);
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=consent_denied`);
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=missing_params`);
  }

  try {
    await ensureCalendarTablesExist();

    // 1. Look up the state in the database
    const stateRecords = await db
      .select()
      .from(oauthStates)
      .where(
        and(
          eq(oauthStates.id, stateParam),
          eq(oauthStates.provider, 'google')
        )
      );

    const stateRecord = stateRecords[0];

    if (!stateRecord) {
      console.error('[Google OAuth] State not found or wrong provider. Possible CSRF attack.');
      return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=invalid_state`);
    }

    // 2. Single-use: delete the state immediately
    await db.delete(oauthStates).where(eq(oauthStates.id, stateParam));

    // 3. Check expiry
    if (stateRecord.expiresAt.getTime() < Date.now()) {
      console.error('[Google OAuth] State expired.');
      return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=state_expired`);
    }

    // 4. Get the userId from the stored state
    const userId = stateRecord.userId;

    // 5. Clean up any other expired states
    await db.delete(oauthStates).where(lt(oauthStates.expiresAt, new Date())).catch(() => {});

    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI || `${url.origin}/api/calendar/google/callback`;

    const provider = new GoogleCalendarProvider();
    if (!provider.isConfigured()) {
      console.error('[Google OAuth Callback] Provider not configured.');
      return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=config_error`);
    }

    // 6. Exchange authorization code for tokens
    const tokens = await provider.exchangeCode(code, redirectUri);

    // 7. Encrypt tokens
    const encryptedAccess = encryptToken(tokens.accessToken);
    const encryptedRefresh = encryptToken(tokens.refreshToken);

    const calendarEmail: string | null = tokens.providerAccountId || null;
    const connectionId = crypto.randomUUID();
    const timestamp = new Date();

    // 8. Deactivate any existing active Google connections for this user
    await db
      .update(calendarConnections)
      .set({ status: 'REVOKED', revokedAt: timestamp, updatedAt: timestamp })
      .where(
        and(
          eq(calendarConnections.userId, userId),
          eq(calendarConnections.provider, 'google'),
          eq(calendarConnections.status, 'ACTIVE')
        )
      );

    // 9. Store the new connection
    await db.insert(calendarConnections).values({
      id: connectionId,
      userId,
      provider: 'google',
      providerAccountId: tokens.providerAccountId,
      calendarId: 'primary',
      calendarEmail,
      encryptedAccessToken: encryptedAccess,
      encryptedRefreshToken: encryptedRefresh,
      tokenExpiresAt: tokens.expiresAt,
      scopes: JSON.stringify(tokens.scopes),
      status: 'ACTIVE',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // 10. Audit log
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      userId,
      action: 'CALENDAR_CONNECTED',
      resource: 'GOOGLE_CALENDAR',
      result: 'SUCCESS',
      timestamp,
    });

    return NextResponse.redirect(`${url.origin}/dashboard/calendar?connected=google`);
  } catch (err: any) {
    console.error('[Google OAuth Callback Error]:', err?.message);
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=auth_failed`);
  }
}
