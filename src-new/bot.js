// Main bot instance with handlers
import { Bot } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { apiThrottler } from '@grammyjs/transformer-throttler';
import { env } from './config/env.js';

// Middlewares
import { logger } from './middlewares/logger.js';
import { session } from './middlewares/session.js';
import { pauseMiddleware } from './middlewares/pause.js';

// Handlers
import { handleStart, handleWizardCallback } from './modules/core/start.js';
import { handleSchedule, handleNext, handleTimer } from './modules/schedule/handlers.js';

// Keyboards
import * as keyboards from './ui/keyboards/inline.js';
import * as storage from './services/storage.js';

export function createBot() {
  const bot = new Bot(env.BOT_TOKEN);
  
  // Add plugins
  bot.api.config.use(autoRetry());
  bot.api.config.use(apiThrottler());
  
  // Add middlewares
  bot.use(logger());
  bot.use(session());
  bot.use(pauseMiddleware());
  
  console.log('🤖 Bot instance created');
  
  // Command handlers
  bot.command('start', handleStart);
  bot.command('schedule', handleSchedule);
  bot.command('next', handleNext);
  bot.command('timer', handleTimer);
  
  bot.command('settings', async (ctx) => {
    const telegramId = String(ctx.from.id);
    const user = storage.getUserByTelegramId(telegramId);
    
    if (!user) {
      await ctx.reply('❌ Спочатку налаштуйте бота за допомогою /start');
      return;
    }
    
    const isAdmin = telegramId === env.OWNER_ID || env.ADMIN_IDS.includes(telegramId);
    await ctx.reply('⚙️ Налаштування', keyboards.getSettingsKeyboard(isAdmin));
  });
  
  bot.command('channel', async (ctx) => {
    await ctx.reply('📺 Управління каналом\n\nФункція в розробці', keyboards.getMainMenu());
  });
  
  bot.command('admin', async (ctx) => {
    const telegramId = String(ctx.from.id);
    const isAdmin = telegramId === env.OWNER_ID || env.ADMIN_IDS.includes(telegramId);
    
    if (!isAdmin) {
      await ctx.reply('❌ Ця команда доступна тільки адміністраторам');
      return;
    }
    
    await ctx.reply('👑 Адмін-панель', keyboards.getAdminKeyboard());
  });
  
  bot.command('cancel', async (ctx) => {
    await ctx.reply('✓ Операція скасована', keyboards.getMainMenu());
  });
  
  // Callback query handlers
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const telegramId = String(ctx.from.id);
    
    try {
      // Wizard callbacks
      if (data.startsWith('region_') || data.startsWith('queue_') || 
          data.startsWith('wizard_') || data === 'back_to_region') {
        await handleWizardCallback(ctx);
        return;
      }
      
      // Menu navigation
      if (data === 'back_to_main') {
        const user = storage.getUserByTelegramId(telegramId);
        const botStatus = user?.channel_id ? 'active' : 'no_channel';
        const channelPaused = user?.channel_status === 'paused';
        
        await ctx.editMessageText(
          '🏠 Головне меню',
          keyboards.getMainMenu(botStatus, channelPaused)
        );
        await ctx.answerCallbackQuery();
        return;
      }
      
      if (data === 'back_to_settings') {
        const isAdmin = telegramId === env.OWNER_ID || env.ADMIN_IDS.includes(telegramId);
        await ctx.editMessageText('⚙️ Налаштування', keyboards.getSettingsKeyboard(isAdmin));
        await ctx.answerCallbackQuery();
        return;
      }
      
      if (data === 'menu_schedule') {
        await handleSchedule(ctx);
        await ctx.answerCallbackQuery();
        return;
      }
      
      if (data === 'menu_timer') {
        await handleTimer(ctx);
        await ctx.answerCallbackQuery();
        return;
      }
      
      if (data === 'menu_help') {
        await ctx.editMessageText('❓ Допомога', keyboards.getHelpKeyboard());
        await ctx.answerCallbackQuery();
        return;
      }
      
      if (data === 'menu_settings') {
        const isAdmin = telegramId === env.OWNER_ID || env.ADMIN_IDS.includes(telegramId);
        await ctx.editMessageText('⚙️ Налаштування', keyboards.getSettingsKeyboard(isAdmin));
        await ctx.answerCallbackQuery();
        return;
      }
      
      if (data === 'menu_stats') {
        await ctx.editMessageText(
          '📈 Статистика\n\nФункція в розробці',
          keyboards.getStatisticsKeyboard()
        );
        await ctx.answerCallbackQuery();
        return;
      }
      
      if (data === 'settings_region') {
        await ctx.answerCallbackQuery('Зміна регіону в розробці');
        return;
      }
      
      if (data === 'settings_channel') {
        const user = storage.getUserByTelegramId(telegramId);
        const channelId = user?.channel_id;
        const channelStatus = user?.channel_status || 'active';
        const isPublic = channelId?.startsWith('@');
        
        await ctx.editMessageText(
          '📺 Управління каналом',
          keyboards.getChannelMenuKeyboard(channelId, isPublic, channelStatus)
        );
        await ctx.answerCallbackQuery();
        return;
      }
      
      if (data === 'settings_ip') {
        await ctx.editMessageText('📡 IP моніторинг', keyboards.getIpMonitoringKeyboard());
        await ctx.answerCallbackQuery();
        return;
      }
      
      if (data === 'settings_alerts') {
        await ctx.editMessageText(
          '🔔 Налаштування сповіщень\n\nФункція в розробці',
          keyboards.getAlertsSettingsKeyboard()
        );
        await ctx.answerCallbackQuery();
        return;
      }
      
      if (data === 'settings_admin' || data === 'admin_menu') {
        const isAdmin = telegramId === env.OWNER_ID || env.ADMIN_IDS.includes(telegramId);
        if (!isAdmin) {
          await ctx.answerCallbackQuery('❌ Доступ заборонено');
          return;
        }
        await ctx.editMessageText('👑 Адмін-панель', keyboards.getAdminKeyboard());
        await ctx.answerCallbackQuery();
        return;
      }
      
      if (data === 'help_howto') {
        await ctx.answerCallbackQuery({
          text: '📖 Як користуватись:\n\n1. Обери регіон та чергу\n2. Підключи канал (опційно)\n3. Додай IP роутера (опційно)\n4. Готово! Бот сповіщатиме про відключення',
          show_alert: true
        });
        return;
      }
      
      // Default: not implemented yet
      await ctx.answerCallbackQuery('Функція в розробці');
      
    } catch (error) {
      console.error('Error handling callback:', error);
      await ctx.answerCallbackQuery('Виникла помилка');
    }
  });
  
  // Handle channel member updates (for channel connections)
  bot.on('my_chat_member', async (ctx) => {
    console.log('Chat member update:', ctx.update.my_chat_member);
  });
  
  // Error handler
  bot.catch((err) => {
    console.error('Bot error:', err);
  });
  
  return bot;
}
