// Schedule module - handles schedule commands
import * as storage from '../../services/storage.js';
import * as scheduleService from '../../services/schedules.js';
import { REGIONS } from '../../config/constants.js';
import * as keyboards from '../../ui/keyboards/inline.js';

export async function handleSchedule(ctx) {
  const telegramId = String(ctx.from.id);
  
  try {
    const user = storage.getUserByTelegramId(telegramId);
    
    if (!user) {
      await ctx.reply('❌ Спочатку налаштуйте бота за допомогою /start');
      return;
    }
    
    const scheduleData = await scheduleService.fetchScheduleData(user.region);
    const regionName = REGIONS[user.region]?.name || user.region;
    
    if (!scheduleData || !scheduleData.hasData) {
      await ctx.reply(
        `📊 Графік для ${regionName}, черга ${user.queue}\n\n` +
        'ℹ️ Немає даних про відключення',
        keyboards.getMainMenu()
      );
      return;
    }
    
    // Simplified schedule message
    await ctx.reply(
      `📊 Графік для ${regionName}, черга ${user.queue}\n\n` +
      '✅ Дані отримано. Детальний графік буде показано в наступній версії.',
      keyboards.getMainMenu()
    );
  } catch (error) {
    console.error('Error in handleSchedule:', error);
    await ctx.reply('❌ Помилка отримання графіка', keyboards.getErrorKeyboard());
  }
}

export async function handleNext(ctx) {
  await ctx.reply(
    '⏱ Наступне відключення\n\n' +
    'Функція в розробці',
    keyboards.getMainMenu()
  );
}

export async function handleTimer(ctx) {
  await ctx.reply(
    '⏱ Таймер\n\n' +
    'Функція в розробці',
    keyboards.getMainMenu()
  );
}
