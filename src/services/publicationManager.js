/**
 * Publication Idempotency Manager
 * 
 * Ensures that publications are idempotent - no duplicate messages
 * Uses signature-based deduplication with configurable TTL
 * 
 * Signature Format: hash(type + region + queue + dataHash + channelId/userId)
 */

const crypto = require('crypto');
const db = require('../database/db');

// In-memory cache for fast lookups (signature -> expiration timestamp)
const signatureCache = new Map();

// Cleanup interval for expired signatures
let cleanupInterval = null;

/**
 * Initialize the publication manager
 */
function init() {
  console.log('🔐 Initializing publication idempotency manager...');
  
  // Start cleanup job every hour
  cleanupInterval = setInterval(() => {
    cleanup();
  }, 60 * 60 * 1000); // 1 hour
  
  console.log('✅ Publication idempotency manager initialized');
}

/**
 * Stop the publication manager
 */
function stop() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Generate a signature for a publication
 * 
 * @param {Object} params - Publication parameters
 * @param {string} params.type - Type of publication (schedule_new, schedule_update, power_on, power_off, etc.)
 * @param {string} params.region - Region code
 * @param {string} params.queue - Queue number
 * @param {string} params.dataHash - Hash of the actual data being published
 * @param {string} [params.userId] - User ID (for private messages)
 * @param {string} [params.channelId] - Channel ID (for channel publications)
 * @returns {string} Signature hash
 */
function generateSignature(params) {
  const { type, region, queue, dataHash, userId, channelId } = params;
  
  // Validate required params
  if (!type || !dataHash) {
    throw new Error('type and dataHash are required for signature generation');
  }
  
  // Build signature components
  const components = [
    type,
    region || '',
    queue || '',
    dataHash,
    userId || '',
    channelId || ''
  ];
  
  // Generate hash
  const signature = crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex');
  
  return signature;
}

/**
 * Check if a publication has already been published
 * 
 * @param {string} signature - Publication signature
 * @returns {Promise<boolean>} True if already published, false otherwise
 */
async function hasBeenPublished(signature) {
  // Check cache first (fast path)
  if (signatureCache.has(signature)) {
    const expiration = signatureCache.get(signature);
    if (Date.now() < expiration) {
      return true;
    } else {
      // Expired, remove from cache
      signatureCache.delete(signature);
    }
  }
  
  // Check database (slower, but persistent)
  const exists = db.publicationSignatureExists ? 
    await db.publicationSignatureExists(signature) :
    false;
  
  if (exists) {
    // Add to cache for future fast lookups
    const expiration = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
    signatureCache.set(signature, expiration);
    return true;
  }
  
  return false;
}

/**
 * Mark a publication as published
 * 
 * @param {Object} params - Publication parameters (same as generateSignature)
 * @param {number} [ttlDays=7] - Time to live in days (default: 7 days)
 * @returns {Promise<void>}
 */
async function markAsPublished(params, ttlDays = 7) {
  const signature = generateSignature(params);
  
  // Add to cache
  const expiration = Date.now() + (ttlDays * 24 * 60 * 60 * 1000);
  signatureCache.set(signature, expiration);
  
  // Save to database for persistence
  if (db.createPublicationSignature) {
    try {
      await db.createPublicationSignature(
        signature,
        params.type,
        params.region,
        params.queue,
        params.userId,
        params.channelId,
        params.dataHash
      );
    } catch (error) {
      console.error('Error saving publication signature to DB:', error);
      // Continue anyway, cache will handle it temporarily
    }
  }
}

/**
 * Check if a publication should be sent (not already published)
 * If not published, automatically marks it as published
 * 
 * This is the main method to use for idempotency checks
 * 
 * @param {Object} params - Publication parameters
 * @param {number} [ttlDays=7] - Time to live in days
 * @returns {Promise<boolean>} True if should publish, false if already published
 */
async function shouldPublish(params, ttlDays = 7) {
  const signature = generateSignature(params);
  
  // Check if already published
  const alreadyPublished = await hasBeenPublished(signature);
  
  if (alreadyPublished) {
    console.log(`⏭️  Skipping duplicate publication: ${params.type} for ${params.region}/${params.queue}`);
    return false;
  }
  
  // Mark as published
  await markAsPublished(params, ttlDays);
  
  return true;
}

/**
 * Cleanup expired signatures from cache and database
 */
async function cleanup() {
  console.log('🧹 Cleaning up expired publication signatures...');
  
  let cacheCleanedCount = 0;
  const now = Date.now();
  
  // Clean cache
  for (const [signature, expiration] of signatureCache.entries()) {
    if (now >= expiration) {
      signatureCache.delete(signature);
      cacheCleanedCount++;
    }
  }
  
  // Clean database
  if (db.cleanupExpiredSignatures) {
    try {
      await db.cleanupExpiredSignatures();
    } catch (error) {
      console.error('Error cleaning up signatures from DB:', error);
    }
  }
  
  if (cacheCleanedCount > 0) {
    console.log(`✅ Cleaned up ${cacheCleanedCount} expired signatures from cache`);
  }
}

/**
 * Clear all signatures for a specific user (useful for testing or user reset)
 * 
 * @param {string} userId - User ID
 */
async function clearUserSignatures(userId) {
  // Clear from cache
  for (const [signature, _] of signatureCache.entries()) {
    if (signature.includes(userId)) {
      signatureCache.delete(signature);
    }
  }
  
  // Note: Database cleanup for specific user would require additional DB method
  console.log(`✅ Cleared publication signatures for user ${userId} from cache`);
}

/**
 * Get cache statistics
 * 
 * @returns {Object} Cache stats
 */
function getCacheStats() {
  return {
    size: signatureCache.size,
    signatures: Array.from(signatureCache.keys())
  };
}

module.exports = {
  init,
  stop,
  generateSignature,
  hasBeenPublished,
  markAsPublished,
  shouldPublish,
  cleanup,
  clearUserSignatures,
  getCacheStats
};
