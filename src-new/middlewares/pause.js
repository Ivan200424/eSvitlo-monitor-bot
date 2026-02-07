import { env } from '../config/env.js';

// Pause mode state
let isPaused = false;
let pauseMessage = '🔧 Бот тимчасово недоступний. Спробуйте пізніше.';
let showSupportButton = false;

export function setPauseMode(enabled, message = null, showSupport = false) {
  isPaused = enabled;
  if (message) pauseMessage = message;
  showSupportButton = showSupport;
}

export function isPauseMode() {
  return isPaused;
}

export function getPauseMessage() {
  return pauseMessage;
}

// Pause middleware - blocks all non-admin commands when enabled
export function pauseMiddleware() {
  return async (ctx, next) => {
    const userId = ctx.from?.id?.toString();
    const isAdmin = userId === env.OWNER_ID || env.ADMIN_IDS.includes(userId);
    
    // Allow admins through
    if (isAdmin) {
      return next();
    }
    
    // If paused, send pause message instead of processing
    if (isPaused) {
      const keyboard = showSupportButton ? {
        inline_keyboard: [
          [{ text: '💬 Обговорення/Підтримка', url: 'https://t.me/svitlocheckchat' }]
        ]
      } : undefined;
      
      await ctx.reply(pauseMessage, { reply_markup: keyboard });
      return;
    }
    
    return next();
  };
}
