/**
 * Message Format Templates v2.0
 * 
 * Strict adherence to message formats specified in technical requirements
 * All templates MUST be used exactly as defined
 * 
 * Unicode symbols are allowed and recommended
 */

const { formatDateUkrainian, formatTimeUkrainian, formatDuration } = require('../utils');

/**
 * Template 1: Schedule updated for today
 * 
 * Example:
 * 💡 Оновлено графік відключень на сьогодні, 04.02.2026 (Середа), для черги 3.1:
 * 
 * 🪫 00:00 - 03:00 (~3 год)
 * 🪫 06:30 - 13:30 (~7 год)
 * 🪫 17:00 - 00:00 (~7 год)
 * 
 * Загалом без світла: ~17 год
 * 
 * @param {Object} params - Parameters
 * @param {string} params.date - Date in format "DD.MM.YYYY"
 * @param {string} params.dayOfWeek - Day of week in Ukrainian
 * @param {string} params.queue - Queue number (e.g., "3.1")
 * @param {Array} params.outages - Array of outage periods [{start, end, duration}]
 * @param {number} params.totalHours - Total hours without power
 * @returns {string} Formatted message
 */
function formatScheduleUpdatedToday({ date, dayOfWeek, queue, outages, totalHours }) {
  let message = `💡 Оновлено графік відключень на сьогодні, ${date} (${dayOfWeek}), для черги ${queue}:\n\n`;
  
  for (const outage of outages) {
    message += `🪫 ${outage.start} - ${outage.end} (~${outage.duration} год)\n`;
  }
  
  message += `\nЗагалом без світла: ~${totalHours} год`;
  
  return message;
}

/**
 * Template 2: Schedule appeared for tomorrow
 * 
 * Example:
 * 💡 Зʼявився графік відключень на завтра, 05.02.2026 (Четвер), для черги 3.1:
 * 
 * 🪫 00:00 - 03:00 (~3 год)
 * 🪫 06:30 - 13:30 (~7 год)
 * 🪫 17:00 - 22:00 (~5 год)
 * 
 * Загалом без світла: ~15 год
 * 
 * @param {Object} params - Parameters (same as above)
 * @returns {string} Formatted message
 */
function formatScheduleAppearedTomorrow({ date, dayOfWeek, queue, outages, totalHours }) {
  let message = `💡 Зʼявився графік відключень на завтра, ${date} (${dayOfWeek}), для черги ${queue}:\n\n`;
  
  for (const outage of outages) {
    message += `🪫 ${outage.start} - ${outage.end} (~${outage.duration} год)\n`;
  }
  
  message += `\nЗагалом без світла: ~${totalHours} год`;
  
  return message;
}

/**
 * Template 3: Schedule unchanged for today
 * 
 * Example:
 * 💡 Графік на сьогодні без змін:
 * 
 * 🪫 00:00 - 06:00 (~6 год)
 * 🪫 09:30 - 16:30 (~7 год)
 * 🪫 20:00 - 00:00 (~4 год)
 * 
 * Загалом без світла: ~17 год
 * 
 * @param {Object} params - Parameters
 * @param {Array} params.outages - Array of outage periods
 * @param {number} params.totalHours - Total hours without power
 * @returns {string} Formatted message
 */
function formatScheduleUnchanged({ outages, totalHours }) {
  let message = `💡 Графік на сьогодні без змін:\n\n`;
  
  for (const outage of outages) {
    message += `🪫 ${outage.start} - ${outage.end} (~${outage.duration} год)\n`;
  }
  
  message += `\nЗагалом без світла: ~${totalHours} год`;
  
  return message;
}

/**
 * Template 4: Power appeared (turned on)
 * 
 * Example:
 * 🟢 18:17 Світло зʼявилося
 * 🕓 Його не було: 10 год 49 хв
 * 🗓 Наступне планове: 21:30 – 00:00
 * 
 * @param {Object} params - Parameters
 * @param {string} params.time - Time when power appeared (HH:MM)
 * @param {string} params.outDuration - How long power was out (e.g., "10 год 49 хв")
 * @param {string} [params.nextOutage] - Next planned outage (optional, e.g., "21:30 – 00:00")
 * @returns {string} Formatted message
 */
function formatPowerAppeared({ time, outDuration, nextOutage }) {
  let message = `🟢 ${time} Світло зʼявилося\n`;
  message += `🕓 Його не було: ${outDuration}\n`;
  
  if (nextOutage) {
    message += `🗓 Наступне планове: ${nextOutage}`;
  }
  
  return message;
}

/**
 * Template 5: Power disappeared (turned off)
 * 
 * Example:
 * 🔴 21:38 Світло зникло
 * 🕓 Воно було: 3 год 20 хв
 * 🗓 Світло має зʼявитися: 00:00
 * 
 * @param {Object} params - Parameters
 * @param {string} params.time - Time when power disappeared (HH:MM)
 * @param {string} params.onDuration - How long power was on (e.g., "3 год 20 хв")
 * @param {string} [params.nextRestoration] - When power should return (optional, e.g., "00:00")
 * @returns {string} Formatted message
 */
function formatPowerDisappeared({ time, onDuration, nextRestoration }) {
  let message = `🔴 ${time} Світло зникло\n`;
  message += `🕓 Воно було: ${onDuration}\n`;
  
  if (nextRestoration) {
    message += `🗓 Світло має зʼявитися: ${nextRestoration}`;
  }
  
  return message;
}

/**
 * Template 6: Schedule removed (no schedule available)
 * 
 * Example:
 * 💡 Графік на сьогодні знято
 * 
 * @returns {string} Formatted message
 */
function formatScheduleRemoved() {
  return `💡 Графік на сьогодні знято`;
}

/**
 * Template 7: No schedule data available
 * 
 * Example:
 * 💡 Графік ще не опублікований
 * 
 * @returns {string} Formatted message
 */
function formatNoSchedule() {
  return `💡 Графік ще не опублікований`;
}

/**
 * Helper: Format duration in Ukrainian
 * 
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration (e.g., "3 год 20 хв")
 */
function formatDurationUkrainian(minutes) {
  if (minutes < 60) {
    return `${minutes} хв`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (mins === 0) {
    return `${hours} год`;
  }
  
  return `${hours} год ${mins} хв`;
}

/**
 * Helper: Calculate total hours from outages
 * 
 * @param {Array} outages - Array of outage periods
 * @returns {number} Total hours
 */
function calculateTotalHours(outages) {
  return outages.reduce((sum, outage) => {
    return sum + (outage.duration || 0);
  }, 0);
}

/**
 * Helper: Parse schedule data and format outages
 * 
 * @param {Object} scheduleData - Raw schedule data
 * @returns {Array} Formatted outages [{start, end, duration}]
 */
function parseOutages(scheduleData) {
  // This is a placeholder - implement based on actual schedule data structure
  // Should return array of {start: "HH:MM", end: "HH:MM", duration: N}
  return [];
}

/**
 * Validate message format (for testing)
 * 
 * @param {string} message - Message to validate
 * @param {string} templateType - Expected template type
 * @returns {boolean} True if valid
 */
function validateMessageFormat(message, templateType) {
  const patterns = {
    scheduleUpdatedToday: /^💡 Оновлено графік відключень на сьогодні/,
    scheduleAppearedTomorrow: /^💡 Зʼявився графік відключень на завтра/,
    scheduleUnchanged: /^💡 Графік на сьогодні без змін/,
    powerAppeared: /^🟢 \d{2}:\d{2} Світло зʼявилося/,
    powerDisappeared: /^🔴 \d{2}:\d{2} Світло зникло/,
    scheduleRemoved: /^💡 Графік на сьогодні знято$/,
    noSchedule: /^💡 Графік ще не опублікований$/
  };
  
  const pattern = patterns[templateType];
  if (!pattern) {
    console.error(`Unknown template type: ${templateType}`);
    return false;
  }
  
  return pattern.test(message);
}

module.exports = {
  // Main templates
  formatScheduleUpdatedToday,
  formatScheduleAppearedTomorrow,
  formatScheduleUnchanged,
  formatPowerAppeared,
  formatPowerDisappeared,
  formatScheduleRemoved,
  formatNoSchedule,
  
  // Helpers
  formatDurationUkrainian,
  calculateTotalHours,
  parseOutages,
  validateMessageFormat
};
