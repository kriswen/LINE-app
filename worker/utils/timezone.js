// Timezone utilities for Asia/Taipei

/**
 * Get current date string in Asia/Taipei timezone (YYYY-MM-DD)
 */
export function getTaipeiDateString(date = new Date()) {
  return date.toLocaleString('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Get current time string in Asia/Taipei timezone (HH:MM)
 */
export function getTaipeiTimeString(date = new Date()) {
  return date.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Get current datetime string in Asia/Taipei timezone (ISO format with +08:00 offset)
 */
export function getTaipeiDateTimeString(date = new Date()) {
  const taipeiStr = date.toLocaleString('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(', ', 'T');

  return `${taipeiStr}+08:00`;
}

/**
 * Parse a datetime-local input value (from HTML input type="datetime-local")
 * and return an ISO string with +08:00 offset
 */
export function parseDateTimeLocal(value) {
  // value format: "YYYY-MM-DDTHH:MM"
  if (!value.includes('+') && !value.includes('Z')) {
    return value + '+08:00';
  }
  return value;
}

/**
 * Check if a cron time (HH:MM) matches current Taipei time
 */
export function isTimeMatch(cronTime, date = new Date()) {
  return cronTime === getTaipeiTimeString(date);
}

/**
 * Check if a day of week (0=Sunday) matches current Taipei day
 */
export function isDayMatch(daysOfWeek, date = new Date()) {
  return daysOfWeek.includes(getTaipeiDayOfWeek(date));
}

export function getTaipeiDayOfWeek(date = new Date()) {
  const weekday = date.toLocaleString('en-US', {
    timeZone: 'Asia/Taipei',
    weekday: 'short',
  });
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
}