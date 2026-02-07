import 'dotenv/config';

export const env = {
  // Bot configuration
  BOT_TOKEN: process.env.BOT_TOKEN,
  OWNER_ID: '1026177113',
  ADMIN_IDS: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [],
  
  // Server configuration
  PORT: parseInt(process.env.PORT || process.env.WEBHOOK_PORT || '3000', 10),
  WEBHOOK_URL: process.env.WEBHOOK_URL || '',
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || '',
  
  // Database
  DATABASE_PATH: process.env.DATABASE_PATH || './data/bot.db',
  
  // Monitoring intervals
  CHECK_INTERVAL_SECONDS: parseInt(process.env.CHECK_INTERVAL_SECONDS || '60', 10),
  POWER_CHECK_INTERVAL: parseInt(process.env.POWER_CHECK_INTERVAL || '2', 10),
  POWER_DEBOUNCE_MINUTES: parseInt(process.env.POWER_DEBOUNCE_MINUTES || '5', 10),
  
  // Router monitoring
  ROUTER_HOST: process.env.ROUTER_HOST || null,
  ROUTER_PORT: parseInt(process.env.ROUTER_PORT || '80', 10),
  
  // Timezone
  TIMEZONE: process.env.TZ || 'Europe/Kyiv',
};

// Validation
if (!env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required');
}

if (!env.WEBHOOK_URL) {
  throw new Error('WEBHOOK_URL is required for webhook mode');
}
