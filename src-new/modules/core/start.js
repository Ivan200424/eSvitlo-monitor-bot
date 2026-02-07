// Core module - handles /start command and wizard flow
import * as storage from '../../services/storage.js';
import * as keyboards from '../../ui/keyboards/inline.js';
import { texts, formatWelcomeMessage } from '../../ui/messages/texts.js';
import { REGIONS } from '../../config/constants.js';

// In-memory wizard states (can be moved to storage)
const wizardStates = new Map();

function setWizardState(telegramId, data) {
  wizardStates.set(telegramId, data);
}

function getWizardState(telegramId) {
  return wizardStates.get(telegramId);
}

function clearWizardState(telegramId) {
  wizardStates.delete(telegramId);
}

function isInWizard(telegramId) {
  const state = getWizardState(telegramId);
  return !!(state && state.step);
}

export async function handleStart(ctx) {
  const chatId = ctx.chat.id;
  const telegramId = String(ctx.from.id);
  const username = ctx.from.username || ctx.from.first_name;
  
  try {
    if (isInWizard(telegramId)) {
      await ctx.reply(texts.errors.wizardIncomplete);
      return;
    }
    
    const user = storage.getUserByTelegramId(telegramId);
    
    if (user) {
      if (!user.is_active) {
        await ctx.reply(
          '👋 З поверненням!\n\n' +
          'Ваш профіль було деактивовано.\n\n' +
          'Оберіть опцію:',
          keyboards.getRestorationKeyboard()
        );
        return;
      }
      
      const botStatus = user.channel_id ? 'active' : 'no_channel';
      const channelPaused = user.channel_status === 'paused';
      
      await ctx.reply(
        formatWelcomeMessage(username) + '\n\n🏠 Головне меню',
        keyboards.getMainMenu(botStatus, channelPaused)
      );
    } else {
      await startWizard(ctx, telegramId, username);
    }
  } catch (error) {
    console.error('Error in handleStart:', error);
    await ctx.reply(texts.errors.generic, keyboards.getErrorKeyboard());
  }
}

async function startWizard(ctx, telegramId, username) {
  setWizardState(telegramId, { step: 'region', mode: 'new', username });
  
  await ctx.reply(texts.welcome.new, keyboards.getRegionKeyboard());
}

export async function handleWizardCallback(ctx) {
  const telegramId = String(ctx.from.id);
  const data = ctx.callbackQuery.data;
  const state = getWizardState(telegramId);
  
  if (!state) {
    await ctx.answerCallbackQuery('Сесія застаріла. Почніть спочатку з /start');
    return;
  }
  
  try {
    if (data.startsWith('region_')) {
      const region = data.replace('region_', '');
      state.region = region;
      state.step = 'queue';
      setWizardState(telegramId, state);
      
      await ctx.editMessageText(texts.welcome.selectQueue, keyboards.getQueueKeyboard());
      await ctx.answerCallbackQuery();
    }
    else if (data.startsWith('queue_')) {
      const queue = data.replace('queue_', '');
      state.queue = queue;
      state.step = 'notify_target';
      setWizardState(telegramId, state);
      
      const regionName = REGIONS[state.region]?.name || state.region;
      await ctx.editMessageText(
        texts.welcome.notifyTarget + `\n\n` +
        `📍 Регіон: <b>${regionName}</b>\n` +
        `📊 Черга: <b>${queue}</b>`,
        {
          parse_mode: 'HTML',
          ...keyboards.getWizardNotifyTargetKeyboard()
        }
      );
      await ctx.answerCallbackQuery();
    }
    else if (data === 'wizard_notify_bot') {
      // User chose to receive notifications in bot
      await completeWizard(ctx, telegramId, state, 'bot');
    }
    else if (data === 'wizard_notify_channel') {
      // User chose to receive notifications in channel
      await ctx.editMessageText(texts.welcome.channel);
      await ctx.answerCallbackQuery('Функція каналу буде доступна після завершення налаштувань');
      await completeWizard(ctx, telegramId, state, 'bot');
    }
    else if (data === 'back_to_region') {
      state.step = 'region';
      delete state.queue;
      setWizardState(telegramId, state);
      
      await ctx.editMessageText(texts.welcome.selectRegion, keyboards.getRegionKeyboard());
      await ctx.answerCallbackQuery();
    }
    else if (data === 'wizard_notify_back') {
      state.step = 'queue';
      setWizardState(telegramId, state);
      
      await ctx.editMessageText(texts.welcome.selectQueue, keyboards.getQueueKeyboard());
      await ctx.answerCallbackQuery();
    }
  } catch (error) {
    console.error('Error in handleWizardCallback:', error);
    await ctx.answerCallbackQuery('Виникла помилка');
  }
}

async function completeWizard(ctx, telegramId, state, notifyTarget) {
  try {
    // Create user in database
    storage.createUser(telegramId, state.username, state.region, state.queue);
    
    clearWizardState(telegramId);
    
    const regionName = REGIONS[state.region]?.name || state.region;
    
    await ctx.editMessageText(
      '✅ <b>Налаштування завершено!</b>\n\n' +
      `📍 Регіон: <b>${regionName}</b>\n` +
      `📊 Черга: <b>${state.queue}</b>\n\n` +
      'Тепер ви будете отримувати сповіщення про відключення.',
      {
        parse_mode: 'HTML',
        ...keyboards.getMainMenu('no_channel', false)
      }
    );
    await ctx.answerCallbackQuery('✓ Готово!');
  } catch (error) {
    console.error('Error completing wizard:', error);
    await ctx.answerCallbackQuery('Помилка збереження');
  }
}
