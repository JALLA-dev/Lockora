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

  // Diagnostic check
  const hasClientId = Boolean(process.env.MICROSOFT_CLIENT_ID || process.env.AZURE_OUTLOOK_CLIENT_ID);
  const hasClientSecret = Boolean(process.env.MICROSOFT_CLIENT_SECRET || process.env.AZURE_OUTLOOK_CLIENT_SECRET);
  
  if (!hasClientId || !hasClientSecret) {
    console.error(`[Outlook Connect] Microsoft Entra app not configured. Diagnostic: CLIENT_ID_EXISTS=${hasClientId}, CLIENT_SECRET_EXISTS=${hasClientSecret}`);
    const missingVar = !hasClientId ? 'client_id' : 'client_secret';
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=config_error&missing=${missingVar}`);
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

    const provider = new OutlookCalendarProvider();
    const authUrl = provider.getAuthUrl(stateId, redirectUri);
    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    console.error('[Outlook Connect Error]:', err?.message);
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=server_error`);
  }
}
