export class TimeZoneService {
  /**
   * Formats a Date object to a readable string in a specific IANA timezone (e.g. "Asia/Kolkata", "America/New_York").
   */
  static formatTimeInZone(date: Date, timeZone: string, includeDate: boolean = false): string {
    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone,
    };

    if (includeDate) {
      options.weekday = 'short';
      options.month = 'short';
      options.day = 'numeric';
    }

    try {
      return new Intl.DateTimeFormat('en-US', options).format(date);
    } catch {
      return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(date);
    }
  }

  /**
   * Parses working hours string "HH:MM" for a specific date in a given timezone and returns a UTC Date.
   */
  static getUtcDateFromZoneTime(
    dateStr: string, // "YYYY-MM-DD"
    timeStr: string, // "09:00"
    timeZone: string
  ): Date {
    // Construct local ISO string representation
    const localIso = `${dateStr}T${timeStr}:00.000`;
    
    // We compute UTC offset by converting local time to UTC timestamp
    const now = new Date();
    let tzOffsetMs = 0;
    try {
      const utcString = now.toLocaleString('en-US', { timeZone: 'UTC' });
      const tzString = now.toLocaleString('en-US', { timeZone });
      tzOffsetMs = new Date(tzString).getTime() - new Date(utcString).getTime();
    } catch {
      tzOffsetMs = 0;
    }

    const unadjusted = new Date(`${localIso}Z`);
    return new Date(unadjusted.getTime() - tzOffsetMs);
  }

  /**
   * Returns day of week key ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun') for a given UTC Date in a timezone.
   */
  static getDayOfWeekKey(date: Date, timeZone: string): string {
    const daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    let dayIndex = 0;
    try {
      const dayStr = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(date);
      const lower = dayStr.toLowerCase();
      if (lower.startsWith('mon')) dayIndex = 1;
      else if (lower.startsWith('tue')) dayIndex = 2;
      else if (lower.startsWith('wed')) dayIndex = 3;
      else if (lower.startsWith('thu')) dayIndex = 4;
      else if (lower.startsWith('fri')) dayIndex = 5;
      else if (lower.startsWith('sat')) dayIndex = 6;
      else dayIndex = 0;
    } catch {
      dayIndex = date.getUTCDay();
    }
    return daysMap[dayIndex];
  }
}
