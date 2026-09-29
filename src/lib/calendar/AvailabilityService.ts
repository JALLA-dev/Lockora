import { AvailabilitySettings, AvailableSlot, FreeBusySlot } from './types';
import { TimeZoneService } from './TimeZoneService';

export class AvailabilityService {
  /**
   * Calculates available booking slots for a user on a given date string (YYYY-MM-DD).
   * Ensures private event titles, descriptions, and details are NEVER returned or exposed.
   */
  static generateAvailableSlots(params: {
    dateStr: string; // "YYYY-MM-DD"
    targetTimeZone: string;
    meetingDurationMinutes: number;
    availabilitySettings: AvailabilitySettings;
    externalBusySlots: FreeBusySlot[];
    existingBookings: Array<{ startTime: Date; endTime: Date }>;
    now?: Date;
  }): AvailableSlot[] {
    const {
      dateStr,
      targetTimeZone,
      meetingDurationMinutes,
      availabilitySettings,
      externalBusySlots,
      existingBookings,
    } = params;

    const currentTime = params.now || new Date();
    const userZone = availabilitySettings.timeZone || 'UTC';

    // 1. Min notice check: earliest allowed start time
    const minNoticeMs = (availabilitySettings.minNoticeMinutes || 120) * 60 * 1000;
    const earliestAllowedTime = new Date(currentTime.getTime() + minNoticeMs);

    // 2. Max booking window check: latest allowed start time
    const maxWindowMs = (availabilitySettings.maxBookingDays || 30) * 24 * 60 * 60 * 1000;
    const latestAllowedTime = new Date(currentTime.getTime() + maxWindowMs);

    // Get day of week for target date in user's working timezone
    const sampleDate = TimeZoneService.getUtcDateFromZoneTime(dateStr, '12:00', userZone);
    const dayKey = TimeZoneService.getDayOfWeekKey(sampleDate, userZone);

    const workingHoursList = availabilitySettings.weeklyHours?.[dayKey] || [];
    if (!workingHoursList || workingHoursList.length === 0) {
      return []; // Not a working day
    }

    const availableSlots: AvailableSlot[] = [];
    const bufferMs = (availabilitySettings.bufferMinutes || 15) * 60 * 1000;
    const durationMs = meetingDurationMinutes * 60 * 1000;

    for (const period of workingHoursList) {
      const periodStartUtc = TimeZoneService.getUtcDateFromZoneTime(dateStr, period.start, userZone);
      const periodEndUtc = TimeZoneService.getUtcDateFromZoneTime(dateStr, period.end, userZone);

      let slotStart = new Date(periodStartUtc.getTime());

      while (slotStart.getTime() + durationMs <= periodEndUtc.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + durationMs);

        // Check min notice & max booking window
        if (slotStart.getTime() >= earliestAllowedTime.getTime() && slotStart.getTime() <= latestAllowedTime.getTime()) {
          // Check collision with external busy slots (with before/after buffer)
          const hasExternalConflict = externalBusySlots.some((busy) => {
            const bufferedBusyStart = busy.start.getTime() - bufferMs;
            const bufferedBusyEnd = busy.end.getTime() + bufferMs;
            return slotStart.getTime() < bufferedBusyEnd && slotEnd.getTime() > bufferedBusyStart;
          });

          // Check collision with existing Lockora bookings
          const hasBookingConflict = existingBookings.some((booking) => {
            const bufferedBookingStart = booking.startTime.getTime() - bufferMs;
            const bufferedBookingEnd = booking.endTime.getTime() + bufferMs;
            return slotStart.getTime() < bufferedBookingEnd && slotEnd.getTime() > bufferedBookingStart;
          });

          if (!hasExternalConflict && !hasBookingConflict) {
            const displayTime = TimeZoneService.formatTimeInZone(slotStart, targetTimeZone || userZone);
            availableSlots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
              displayTime,
              timeZone: targetTimeZone || userZone,
            });
          }
        }

        // Increment by slot step (e.g. 15 mins or meeting duration)
        const stepMs = Math.min(15, meetingDurationMinutes) * 60 * 1000;
        slotStart = new Date(slotStart.getTime() + stepMs);
      }
    }

    return availableSlots;
  }
}
