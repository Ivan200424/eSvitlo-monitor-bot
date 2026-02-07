// Deduplication service - prevents duplicate notifications
import crypto from 'crypto';

export function computeHash(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

export function hasChanged(newData, oldHash) {
  const newHash = computeHash(newData);
  return newHash !== oldHash;
}

export function createScheduleHash(scheduleData, date = null) {
  if (!scheduleData || !scheduleData.events) {
    return null;
  }
  
  // Filter events for specific date if provided
  let events = scheduleData.events;
  if (date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    
    events = events.filter(event => {
      const eventStart = new Date(event.start);
      return eventStart >= dayStart && eventStart <= dayEnd;
    });
  }
  
  // Create hash from sorted event times
  const eventKeys = events
    .map(e => `${e.start}_${e.end}`)
    .sort()
    .join('|');
  
  return computeHash(eventKeys);
}
