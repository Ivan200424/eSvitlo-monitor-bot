const { fetchScheduleData, fetchScheduleImage } = require('./api');
const { parseScheduleForQueue, findNextEvent } = require('./parser');
const { formatScheduleMessage } = require('./formatter');

// Публікувати графік з фото та кнопками
async function publishScheduleWithPhoto(bot, user, region, queue) {
  try {
    // Отримуємо дані графіка
    const data = await fetchScheduleData(region);
    const scheduleData = parseScheduleForQueue(data, queue);
    const nextEvent = findNextEvent(scheduleData);
    
    // Форматуємо повідомлення
    const messageText = formatScheduleMessage(region, queue, scheduleData, nextEvent);
    
    // Створюємо inline кнопки
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '⏰ Таймер', callback_data: `timer_${user.id}` },
          { text: '📊 Статистика', callback_data: `stats_${user.id}` }
        ]
      ]
    };
    
    try {
      // Завантажуємо зображення як Buffer
      const imageBuffer = await fetchScheduleImage(region, queue);
      
      // Відправляємо фото з підписом та кнопками
      const sentMessage = await bot.sendPhoto(user.channel_id, imageBuffer, {
        caption: messageText,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard
      });
      
      return sentMessage;
    } catch (imageError) {
      console.log(`Зображення недоступне для ${region}/${queue}, відправляємо тільки текст`);
      
      // Якщо не вдалося завантажити зображення, відправляємо тільки текст
      const sentMessage = await bot.sendMessage(user.channel_id, messageText, {
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard
      });
      
      return sentMessage;
    }
    
  } catch (error) {
    console.error('Помилка публікації графіка:', error);
    throw error;
  }
}

module.exports = {
  publishScheduleWithPhoto,
};
