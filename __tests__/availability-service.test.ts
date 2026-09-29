import { AvailabilityService } from '../src/lib/calendar/AvailabilityService';

describe('Lockora Availability Engine & Privacy Rules', () => {
  const mockSettings = {
    userId: 'user_test123',
    timeZone: 'UTC',
    weeklyHours: {
      mon: [{ start: '09:00', end: '12:00' }],
      tue: [{ start: '09:00', end: '17:00' }],
    },
    bufferMinutes: 15,
    minNoticeMinutes: 0,
    maxBookingDays: 30,
  };

  it('should generate available slots within working hours', () => {
    const slots = AvailabilityService.generateAvailableSlots({
      dateStr: '2026-10-05', // Monday
      targetTimeZone: 'UTC',
      meetingDurationMinutes: 30,
      availabilitySettings: mockSettings,
      externalBusySlots: [],
      existingBookings: [],
      now: new Date('2026-10-01T00:00:00Z'),
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].displayTime).toContain('9:00 AM');
  });

  it('should exclude slots that collide with external busy calendar slots (with buffer)', () => {
    const externalBusy = [
      {
        start: new Date('2026-10-05T09:30:00Z'),
        end: new Date('2026-10-05T10:00:00Z'),
      },
    ];

    const slots = AvailabilityService.generateAvailableSlots({
      dateStr: '2026-10-05', // Monday (09:00 - 12:00)
      targetTimeZone: 'UTC',
      meetingDurationMinutes: 30,
      availabilitySettings: mockSettings,
      externalBusySlots: externalBusy,
      existingBookings: [],
      now: new Date('2026-10-01T00:00:00Z'),
    });

    // 09:30-10:00 is busy + 15 min buffer (09:15-10:15 is blocked)
    const slotTimes = slots.map((s) => s.displayTime);
    expect(slotTimes).not.toContain('9:30 AM');
  });

  it('never returns private calendar titles or descriptions in output', () => {
    const externalBusy = [
      {
        start: new Date('2026-10-05T10:00:00Z'),
        end: new Date('2026-10-05T11:00:00Z'),
      },
    ];

    const slots = AvailabilityService.generateAvailableSlots({
      dateStr: '2026-10-05',
      targetTimeZone: 'UTC',
      meetingDurationMinutes: 30,
      availabilitySettings: mockSettings,
      externalBusySlots: externalBusy,
      existingBookings: [],
      now: new Date('2026-10-01T00:00:00Z'),
    });

    // Verify slot format only contains start, end, displayTime, timeZone
    slots.forEach((s) => {
      expect((s as any).title).toBeUndefined();
      expect((s as any).description).toBeUndefined();
      expect((s as any).attendees).toBeUndefined();
    });
  });
});
