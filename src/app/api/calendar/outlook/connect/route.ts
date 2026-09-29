import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { OutlookCalendarProvider } from '@/lib/calendar/providers/OutlookCalendarProvider';
import { db } from '@/db';
import { oauthStates } from '@/db/schema';
import crypto from 'crypto';
import { ensureCalendarTablesExist } from '@/lib/calendar/db-init';

/**
 * Initiates the Microsoft Outlook Calendar OAuth authorization flow.
 *
 * Security:
 * - Requires an authenticated Clerk session (userId is taken from Clerk, NOT from the request).
 * - Generates a cryptographically random single-use state value.
 * - Stores the state in the database associated with the Clerk userId.
 * - State expires after 15 minutes.
 * - Checks that the Microsoft Entra app is properly configured before redirecting.
 *
 * This flow is independent of the Lockora Login provider:
 * - A user who logged in with Google CAN connect Outlook Calendar here.
 * - A user who logged in with Microsoft CAN also connect Outlook Calendar here.
 * - Login provider ≠ Calendar provider.
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI || `${url.origin}/api/calendar/outlook/callback`;

  // Check provider is configured BEFORE generating state
  const provider = new OutlookCalendarProvider();
  if (!provider.isConfigured()) {
    console.error('[Outlook Connect] Microsoft Entra app not configured. Check MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET env vars.');
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=config_error`);
  }

  try {
    await ensureCalendarTablesExist();

    // Generate a cryptographically random single-use state token
    const stateId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    const now = new Date();

    // Store state in DB — server-side CSRF protection
    await db.insert(oauthStates).values({
      id: stateId,
      userId,
      provider: 'microsoft',
      expiresAt,
      createdAt: now,
    });

    const authUrl = provider.getAuthUrl(stateId, redirectUri);
    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    console.error('[Outlook Connect Error]:', err?.message);
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=server_error`);
  }
}
