import { NextResponse } from 'next/server';
import { OutlookCalendarProvider } from '@/lib/calendar/providers/OutlookCalendarProvider';
import { db } from '@/db';
import { calendarConnections, oauthStates, auditLogs } from '@/db/schema';
import { encryptToken } from '@/lib/calendar/crypto';
import crypto from 'crypto';
import { eq, and, lt } from 'drizzle-orm';
import { ensureCalendarTablesExist } from '@/lib/calendar/db-init';

/**
 * Handles the Microsoft OAuth callback after the user grants calendar access.
 *
 * Security model:
 * 1. Validates the state parameter against the database (single-use, expiry-checked).
 * 2. The Lockora userId is read from the stored state — NEVER from the URL or request body.
 * 3. Deletes the state record immediately (single-use enforcement).
 * 4. Exchanges the authorization code for tokens via Microsoft Graph.
 * 5. Encrypts access and refresh tokens with AES-256-GCM before database storage.
 * 6. Stores calendarEmail from Microsoft Graph /me (display only — not used for ownership).
 * 7. Never exposes tokens, codes, or secrets to the frontend.
 * 8. Records a safe audit log entry (no tokens logged).
 *
 * This callback is on the public route matcher to allow Microsoft to redirect here
 * even while Clerk may not have re-authenticated the session cookie yet.
 * Ownership is validated via the state record (which was created by an authenticated session).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  const errorDesc = url.searchParams.get('error_description');

  // Handle Microsoft returning an error (e.g. user declined consent)
  if (errorParam) {
    console.error(`[Outlook OAuth] Microsoft returned error: ${errorParam} — ${errorDesc}`);
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=consent_denied`);
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=missing_params`);
  }

  try {
    await ensureCalendarTablesExist();

    // 1. Look up the state in the database — validate it exists, not expired, correct provider
    const stateRecords = await db
      .select()
      .from(oauthStates)
      .where(
        and(
          eq(oauthStates.id, stateParam),
          eq(oauthStates.provider, 'microsoft')
        )
      );

    const stateRecord = stateRecords[0];

    if (!stateRecord) {
      console.error('[Outlook OAuth] State not found or wrong provider. Possible CSRF attack.');
      return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=invalid_state`);
    }

    // 2. Single-use: delete the state immediately to prevent replay attacks
    await db.delete(oauthStates).where(eq(oauthStates.id, stateParam));

    // 3. Check expiry
    if (stateRecord.expiresAt.getTime() < Date.now()) {
      console.error('[Outlook OAuth] State expired.');
      return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=state_expired`);
    }

    // 4. Get the userId from the stored state — NEVER trust a user-supplied userId
    const userId = stateRecord.userId;

    // 5. Clean up any other expired states for hygiene
    await db.delete(oauthStates).where(lt(oauthStates.expiresAt, new Date())).catch(() => {});

    const redirectUri =
      process.env.MICROSOFT_REDIRECT_URI || `${url.origin}/api/calendar/outlook/callback`;

    const provider = new OutlookCalendarProvider();
    if (!provider.isConfigured()) {
      console.error('[Outlook OAuth Callback] Provider not configured.');
      return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=config_error`);
    }

    // 6. Exchange authorization code for tokens (server-side only — code never exposed)
    const tokens = await provider.exchangeCode(code, redirectUri);

    // 7. Encrypt tokens before storage — plaintext tokens are NEVER stored
    const encryptedAccess = encryptToken(tokens.accessToken);
    const encryptedRefresh = encryptToken(tokens.refreshToken);

    // 8. Fetch the Microsoft account email for display purposes only
    // This is NOT used for calendar ownership — ownership is always userId (Clerk ID)
    let calendarEmail: string | null = tokens.providerAccountId || null;
    // providerAccountId from exchangeCode already contains the email from /me

    const connectionId = crypto.randomUUID();
    const timestamp = new Date();

    // 9. Deactivate any existing active connections for this user (replace pattern)
    await db
      .update(calendarConnections)
      .set({ status: 'REVOKED', revokedAt: timestamp, updatedAt: timestamp })
      .where(
        and(
          eq(calendarConnections.userId, userId),
          eq(calendarConnections.provider, 'microsoft'),
          eq(calendarConnections.status, 'ACTIVE')
        )
      );

    // 10. Store the new connection
    await db.insert(calendarConnections).values({
      id: connectionId,
      userId,
      provider: 'microsoft',
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

    // 11. Audit log — NO tokens, codes, or private data logged
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      userId,
      action: 'CALENDAR_CONNECTED',
      resource: 'MICROSOFT_OUTLOOK',
      result: 'SUCCESS',
      timestamp,
    });

    return NextResponse.redirect(`${url.origin}/dashboard/calendar?connected=microsoft`);
  } catch (err: any) {
    console.error('[Outlook OAuth Callback Error]:', err?.message);
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=auth_failed`);
  }
}
