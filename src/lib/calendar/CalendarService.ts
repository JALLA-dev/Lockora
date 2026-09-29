import { CalendarProvider } from './providers/CalendarProvider';
import { OutlookCalendarProvider } from './providers/OutlookCalendarProvider';
import { GoogleCalendarProvider } from './providers/GoogleCalendarProvider';
import { CalendarEventData, CalendarEventResult, CalendarInfo, FreeBusySlot } from './types';
import { db } from '@/db';
import { calendarConnections } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { decryptToken, encryptToken } from './crypto';

export class CalendarService {
  private getProvider(providerName: string): CalendarProvider {
    if (providerName === 'google') {
      return new GoogleCalendarProvider();
    }
    return new OutlookCalendarProvider();
  }

  isConfigured(providerName: 'google' | 'microsoft'): boolean {
    return this.getProvider(providerName).isConfigured();
  }

  async getValidConnection(userId: string, connectionId?: string) {
    let connection;
    if (connectionId) {
      const results = await db
        .select()
        .from(calendarConnections)
        .where(
          and(
            eq(calendarConnections.id, connectionId),
            eq(calendarConnections.userId, userId),
            eq(calendarConnections.status, 'ACTIVE')
          )
        );
      connection = results[0];
    } else {
      // Fallback: just get the first active connection if none specified (for backward compat)
      const results = await db
        .select()
        .from(calendarConnections)
        .where(
          and(
            eq(calendarConnections.userId, userId),
            eq(calendarConnections.status, 'ACTIVE')
          )
        );
      connection = results[0];
    }

    if (!connection) {
      return null;
    }

    const provider = this.getProvider(connection.provider);
    const now = new Date();

    if (connection.tokenExpiresAt.getTime() - now.getTime() < 120 * 1000) {
      try {
        const decryptedRefresh = decryptToken(connection.encryptedRefreshToken);
        const refreshResult = await provider.refreshAccessToken(decryptedRefresh);

        const newEncryptedAccess = encryptToken(refreshResult.accessToken);
        let newEncryptedRefresh = connection.encryptedRefreshToken;
        if (refreshResult.refreshToken) {
          newEncryptedRefresh = encryptToken(refreshResult.refreshToken);
        }

        await db
          .update(calendarConnections)
          .set({
            encryptedAccessToken: newEncryptedAccess,
            encryptedRefreshToken: newEncryptedRefresh,
            tokenExpiresAt: refreshResult.expiresAt,
            updatedAt: new Date(),
          })
          .where(eq(calendarConnections.id, connection.id));

        connection.encryptedAccessToken = newEncryptedAccess;
        connection.tokenExpiresAt = refreshResult.expiresAt;
      } catch (err: any) {
        console.error(`Failed to auto-refresh token for connection ${connection.id}:`, err?.message);
        await db
          .update(calendarConnections)
          .set({ status: 'EXPIRED', updatedAt: new Date() })
          .where(eq(calendarConnections.id, connection.id));
        return null;
      }
    }

    const decryptedAccessToken = decryptToken(connection.encryptedAccessToken);
    return {
      connection,
      provider,
      accessToken: decryptedAccessToken,
    };
  }

  async fetchUserCalendars(userId: string, connectionId: string): Promise<CalendarInfo[]> {
    const validConn = await this.getValidConnection(userId, connectionId);
    if (!validConn) return [];

    return validConn.provider.getCalendars(validConn.accessToken);
  }

  async fetchFreeBusy(
    userId: string,
    startTime: Date,
    endTime: Date
  ): Promise<FreeBusySlot[]> {
    // We should ideally fetch free/busy across ALL selected conflict calendars for the user.
    // For now, this is a placeholder that fetches from the first active connection.
    const validConn = await this.getValidConnection(userId);
    if (!validConn) return [];

    return validConn.provider.getFreeBusy(
      validConn.accessToken,
      validConn.connection.calendarId,
      startTime,
      endTime
    );
  }

  async createBookingEvent(
    userId: string,
    event: CalendarEventData,
    connectionId?: string
  ): Promise<CalendarEventResult | null> {
    const validConn = await this.getValidConnection(userId, connectionId);
    if (!validConn) return null;

    return validConn.provider.createEvent(
      validConn.accessToken,
      validConn.connection.destinationCalendar || validConn.connection.calendarId,
      event
    );
  }

  async cancelBookingEvent(
    userId: string,
    connectionId: string | null,
    externalEventId: string
  ): Promise<boolean> {
    if (!externalEventId) return true;
    const validConn = await this.getValidConnection(userId, connectionId || undefined);
    if (!validConn) return false;

    return validConn.provider.cancelEvent(
      validConn.accessToken,
      validConn.connection.destinationCalendar || validConn.connection.calendarId,
      externalEventId
    );
  }
}

export const calendarService = new CalendarService();
