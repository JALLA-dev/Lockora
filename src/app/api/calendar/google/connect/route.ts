import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GoogleCalendarProvider } from '@/lib/calendar/providers/GoogleCalendarProvider';
import { db } from '@/db';
import { oauthStates } from '@/db/schema';
import crypto from 'crypto';
import { ensureCalendarTablesExist } from '@/lib/calendar/db-init';

/**
 * Initiates the Google Calendar OAuth authorization flow.
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || `${url.origin}/api/calendar/google/callback`;

  // Diagnostic check
  const hasClientId = Boolean(process.env.GOOGLE_CLIENT_ID);
  const hasClientSecret = Boolean(process.env.GOOGLE_CLIENT_SECRET);
  
  if (!hasClientId || !hasClientSecret) {
    console.error(`[Google Connect] Google app not configured. Diagnostic: CLIENT_ID_EXISTS=${hasClientId}, CLIENT_SECRET_EXISTS=${hasClientSecret}`);
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
      provider: 'google',
      expiresAt,
      createdAt: now,
    });

    const provider = new GoogleCalendarProvider();
    const authUrl = provider.getAuthUrl(stateId, redirectUri);
    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    console.error('[Google Connect Error]:', err?.message);
    const safeErrorMsg = encodeURIComponent(err?.message?.substring(0, 100) || 'unknown');
    return NextResponse.redirect(`${url.origin}/dashboard/calendar?error=server_error&details=${safeErrorMsg}`);
  }
}
