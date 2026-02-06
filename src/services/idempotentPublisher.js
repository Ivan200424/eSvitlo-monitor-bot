/**
 * Idempotent Publisher v2.0
 * 
 * Handles all publications with strict idempotency guarantees
 * No duplicate messages, no matter what (restart, network issues, etc.)
 * 
 * Publishing Rules:
 * - Publish ONLY if: schedule appeared, schedule changed, power state changed (after debounce)
 * - DON'T publish: on bot restart, on flapping, on identical data (hash unchanged)
 */

const crypto = require('crypto');
const publicationManager = require('./publicationManager');
const messageTemplates = require('./messageTemplates');

/**
 * Calculate data hash for deduplication
 * 
 * @param {*} data - Data to hash (object, string, etc.)
 * @returns {string} SHA-256 hash
 */
function calculateDataHash(data) {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(dataString).digest('hex');
}

/**
 * Publish schedule update
 * 
 * @param {Object} params - Parameters
 * @param {Object} params.bot - Telegram bot instance
 * @param {string} params.chatId - Chat/Channel ID to publish to
 * @param {string} params.region - Region code
 * @param {string} params.queue - Queue number
 * @param {string} params.type - Publication type (today_update, tomorrow_new, unchanged)
 * @param {Object} params.scheduleData - Schedule data
 * @param {Buffer} [params.imageBuffer] - Optional image buffer
 * @returns {Promise<boolean>} True if published, false if skipped (duplicate)
 */
async function publishSchedule({ bot, chatId, region, queue, type, scheduleData, imageBuffer }) {
  try {
    // Calculate data hash
    const dataHash = calculateDataHash(scheduleData);
    
    // Check idempotency
    const shouldPublish = await publicationManager.shouldPublish({
      type: `schedule_${type}`,
      region,
      queue,
      dataHash,
      channelId: chatId.startsWith('@') || chatId.toString().startsWith('-') ? chatId : undefined,
      userId: !chatId.startsWith('@') && !chatId.toString().startsWith('-') ? chatId : undefined
    });
    
    if (!shouldPublish) {
      return false; // Already published
    }
    
    // Format message based on type
    let message;
    const formattedOutages = formatOutagesFromSchedule(scheduleData);
    const totalHours = messageTemplates.calculateTotalHours(formattedOutages);
    
    switch (type) {
      case 'today_update':
        message = messageTemplates.formatScheduleUpdatedToday({
          date: scheduleData.date,
          dayOfWeek: scheduleData.dayOfWeek,
          queue,
          outages: formattedOutages,
          totalHours
        });
        break;
        
      case 'tomorrow_new':
        message = messageTemplates.formatScheduleAppearedTomorrow({
          date: scheduleData.date,
          dayOfWeek: scheduleData.dayOfWeek,
          queue,
          outages: formattedOutages,
          totalHours
        });
        break;
        
      case 'unchanged':
        message = messageTemplates.formatScheduleUnchanged({
          outages: formattedOutages,
          totalHours
        });
        break;
        
      default:
        console.error(`Unknown schedule publication type: ${type}`);
        return false;
    }
    
    // Publish
    if (imageBuffer) {
      await bot.sendPhoto(chatId, imageBuffer, {
        caption: message,
        parse_mode: 'HTML'
      });
    } else {
      await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML'
      });
    }
    
    console.log(`✅ Published schedule (${type}) for ${region}/${queue} to ${chatId}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error publishing schedule:`, error);
    return false;
  }
}

/**
 * Publish power state change
 * 
 * @param {Object} params - Parameters
 * @param {Object} params.bot - Telegram bot instance
 * @param {string} params.chatId - Chat/Channel ID to publish to
 * @param {string} params.userId - User ID (for signature)
 * @param {string} params.state - Power state (on/off)
 * @param {string} params.time - Time of state change (HH:MM)
 * @param {string} params.duration - Duration in previous state
 * @param {string} [params.nextEvent] - Next scheduled event (optional)
 * @returns {Promise<boolean>} True if published, false if skipped
 */
async function publishPowerState({ bot, chatId, userId, state, time, duration, nextEvent }) {
  try {
    // Calculate data hash
    const dataHash = calculateDataHash({ state, time, duration });
    
    // Check idempotency
    const shouldPublish = await publicationManager.shouldPublish({
      type: `power_${state}`,
      region: null,
      queue: null,
      dataHash,
      userId,
      channelId: chatId.startsWith('@') || chatId.toString().startsWith('-') ? chatId : undefined
    });
    
    if (!shouldPublish) {
      return false; // Already published
    }
    
    // Format message
    let message;
    if (state === 'on') {
      message = messageTemplates.formatPowerAppeared({
        time,
        outDuration: duration,
        nextOutage: nextEvent
      });
    } else {
      message = messageTemplates.formatPowerDisappeared({
        time,
        onDuration: duration,
        nextRestoration: nextEvent
      });
    }
    
    // Publish
    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML'
    });
    
    console.log(`✅ Published power ${state} for user ${userId} to ${chatId}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error publishing power state:`, error);
    return false;
  }
}

/**
 * Helper: Format outages from schedule data
 * 
 * @param {Object} scheduleData - Schedule data
 * @returns {Array} Formatted outages
 */
function formatOutagesFromSchedule(scheduleData) {
  // This should parse the actual schedule data structure
  // For now, returning empty array - implement based on your data structure
  
  if (!scheduleData || !scheduleData.outages) {
    return [];
  }
  
  return scheduleData.outages.map(outage => ({
    start: outage.start,
    end: outage.end,
    duration: outage.duration
  }));
}

/**
 * Batch publish to multiple channels/users
 * Useful for broadcasting schedule updates to all users of a region/queue
 * 
 * @param {Object} params - Parameters
 * @param {Object} params.bot - Telegram bot instance
 * @param {Array} params.targets - Array of {chatId, userId} targets
 * @param {Function} params.publishFn - Function to call for each target
 * @param {number} [params.delayMs=100] - Delay between publishes (to avoid rate limits)
 * @returns {Promise<Object>} Results {published, skipped, failed}
 */
async function batchPublish({ bot, targets, publishFn, delayMs = 100 }) {
  const results = {
    published: 0,
    skipped: 0,
    failed: 0
  };
  
  for (const target of targets) {
    try {
      const published = await publishFn(target);
      if (published) {
        results.published++;
      } else {
        results.skipped++;
      }
      
      // Delay to avoid rate limits
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
    } catch (error) {
      console.error(`Error publishing to ${target.chatId}:`, error);
      results.failed++;
    }
  }
  
  console.log(`📊 Batch publish results: ${results.published} published, ${results.skipped} skipped, ${results.failed} failed`);
  
  return results;
}

/**
 * Check if schedule has changed
 * 
 * @param {string} oldHash - Previous schedule hash
 * @param {string} newHash - New schedule hash
 * @returns {boolean} True if changed
 */
function hasScheduleChanged(oldHash, newHash) {
  return oldHash !== newHash;
}

/**
 * Determine publication type based on schedule state
 * 
 * @param {Object} params - Parameters
 * @param {boolean} params.isFirstTime - Is this the first time seeing this schedule?
 * @param {boolean} params.hasChanged - Has the schedule changed?
 * @param {boolean} params.isTomorrow - Is this tomorrow's schedule?
 * @returns {string|null} Publication type or null if shouldn't publish
 */
function determinePublicationType({ isFirstTime, hasChanged, isTomorrow }) {
  if (isTomorrow && isFirstTime) {
    return 'tomorrow_new';
  }
  
  if (!isTomorrow && hasChanged) {
    return 'today_update';
  }
  
  if (!isTomorrow && !hasChanged && !isFirstTime) {
    return 'unchanged'; // Only if explicitly requested, not automatic
  }
  
  return null; // Don't publish
}

module.exports = {
  calculateDataHash,
  publishSchedule,
  publishPowerState,
  batchPublish,
  hasScheduleChanged,
  determinePublicationType,
  formatOutagesFromSchedule
};
