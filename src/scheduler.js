const cron = require('node-cron');
const { fetchScheduleData } = require('./api');
const { parseScheduleForQueue, findNextEvent } = require('./parser');
const { calculateHash, formatInterval } = require('./utils');
const usersDb = require('./database/users');
const config = require('./config');
const { REGION_CODES } = require('./constants/regions');

let bot = null;

// Ініціалізація планувальника
function initScheduler(botInstance) {
  bot = botInstance;
  console.log('📅 Ініціалізація планувальника...');
  
  // Перевірка графіків - використовуємо секунди з конфігу
  const intervalSeconds = config.checkIntervalSeconds;
  
  // Якщо інтервал >= 60 секунд і ділиться на 60 націло, використовуємо cron в хвилинах
  // Інакше використовуємо setInterval
  if (intervalSeconds >= 60 && intervalSeconds % 60 === 0) {
    const intervalMinutes = intervalSeconds / 60;
    const cronExpression = `*/${intervalMinutes} * * * *`;
    
    cron.schedule(cronExpression, async () => {
      console.log(`🔄 Перевірка графіків... (кожні ${formatInterval(intervalSeconds)})`);
      await checkAllSchedules();
    });
  } else {
    // Для інтервалів < 60 секунд або не кратних 60, використовуємо setInterval
    setInterval(async () => {
      console.log(`🔄 Перевірка графіків... (кожні ${formatInterval(intervalSeconds)})`);
      await checkAllSchedules();
    }, intervalSeconds * 1000);
  }
  
  console.log(`✅ Планувальник запущено (перевірка кожні ${formatInterval(intervalSeconds)})`);
}

// Перевірка всіх графіків
async function checkAllSchedules() {
  try {
    for (const region of REGION_CODES) {
      await checkRegionSchedule(region);
    }
  } catch (error) {
    console.error('Помилка при перевірці графіків:', error);
  }
}

// Перевірка графіка конкретного регіону
async function checkRegionSchedule(region) {
  try {
    // Отримуємо дані для регіону
    const data = await fetchScheduleData(region);
    
    // Отримуємо всіх користувачів для цього регіону
    const users = usersDb.getUsersByRegion(region);
    
    if (users.length === 0) {
      return;
    }
    
    console.log(`Перевірка ${region}: знайдено ${users.length} користувачів`);
    
    for (const user of users) {
      try {
        await checkUserSchedule(user, data);
      } catch (error) {
        console.error(`Помилка перевірки графіка для користувача ${user.telegram_id}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error(`Помилка при перевірці графіка для ${region}:`, error.message);
  }
}

// Перевірка графіка для конкретного користувача
async function checkUserSchedule(user, data) {
  try {
    // Skip blocked channels
    if (user.channel_status === 'blocked') {
      console.log(`[${user.telegram_id}] Пропущено - канал заблоковано`);
      return;
    }
    
    const { calculateScheduleHash } = require('./utils');
    const { parseScheduleForQueue, findNextEvent } = require('./parser');
    
    // Парсимо графік
    const scheduleData = parseScheduleForQueue(data, user.queue);
    
    // Розділяємо події на сьогодні та завтра
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    todayEnd.setMilliseconds(-1);
    
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setMilliseconds(-1);
    
    // Фільтруємо події
    const todayEvents = scheduleData.events ? scheduleData.events.filter(event => {
      const eventStart = new Date(event.start);
      return eventStart >= todayStart && eventStart <= todayEnd;
    }) : [];
    
    const tomorrowEvents = scheduleData.events ? scheduleData.events.filter(event => {
      const eventStart = new Date(event.start);
      return eventStart >= tomorrowStart && eventStart <= tomorrowEnd;
    }) : [];
    
    // Обчислюємо хеші тільки з періодів відключень
    const newHashToday = calculateScheduleHash(todayEvents);
    const newHashTomorrow = calculateScheduleHash(tomorrowEvents);
    
    // Поточна дата в форматі YYYY-MM-DD
    const currentDate = todayStart.toISOString().split('T')[0];
    const tomorrowDate = tomorrowStart.toISOString().split('T')[0];
    
    // КРИТИЧНО: Перевірка переходу календарного дня
    // Якщо last_published_date_today не дорівнює поточній даті, відбувся перехід дня
    const dayTransitioned = user.last_published_date_today && 
                           user.last_published_date_today !== currentDate;
    
    if (dayTransitioned) {
      // Перехід дня: завтрашній стає сьогоднішнім
      console.log(`[${user.telegram_id}] Перехід календарного дня: ${user.last_published_date_today} → ${currentDate}`);
      usersDb.transitionScheduleDay(user.id);
      
      // Оновлюємо локальний об'єкт користувача
      user.schedule_hash_today = user.schedule_hash_tomorrow;
      user.last_published_date_today = user.last_published_date_tomorrow;
      user.schedule_hash_tomorrow = null;
      user.last_published_date_tomorrow = null;
    }
    
    // Визначаємо чи є зміни
    const todayChanged = newHashToday !== user.schedule_hash_today;
    const tomorrowChanged = newHashTomorrow !== user.schedule_hash_tomorrow;
    
    // Визначаємо чи це перша поява графіків
    const todayFirstAppearance = user.schedule_hash_today === null && newHashToday !== null;
    const tomorrowFirstAppearance = user.schedule_hash_tomorrow === null && newHashTomorrow !== null;
    
    // ЗАБОРОНА: якщо жоден хеш не змінився, не публікуємо
    if (!todayChanged && !tomorrowChanged) {
      return;
    }
    
    console.log(`[${user.telegram_id}] Зміни графіка: today=${todayChanged}, tomorrow=${tomorrowChanged}`);
    
    // Визначаємо тип оновлення для форматування повідомлення
    const updateContext = {
      todayChanged,
      tomorrowChanged,
      todayFirstAppearance,
      tomorrowFirstAppearance,
      todayUnchanged: !todayChanged,
      todayDate: currentDate,
      tomorrowDate: tomorrowDate
    };
    
    // Отримуємо налаштування куди публікувати
    const notifyTarget = user.power_notify_target || 'both';
    
    // Відправляємо в особистий чат користувача
    if (notifyTarget === 'bot' || notifyTarget === 'both') {
      try {
        const { formatScheduleMessageNew } = require('./formatter');
        const { fetchScheduleImage } = require('./api');
        
        const message = formatScheduleMessageNew(
          user.region, 
          user.queue, 
          todayEvents, 
          tomorrowEvents, 
          updateContext
        );
        
        // Спробуємо з фото
        try {
          const imageBuffer = await fetchScheduleImage(user.region, user.queue);
          await bot.sendPhoto(user.telegram_id, imageBuffer, {
            caption: message,
            parse_mode: 'HTML'
          }, { filename: 'schedule.png', contentType: 'image/png' });
        } catch (imgError) {
          // Без фото
          await bot.sendMessage(user.telegram_id, message, { parse_mode: 'HTML' });
        }
        
        console.log(`📱 Графік відправлено користувачу ${user.telegram_id}`);
      } catch (error) {
        console.error(`Помилка відправки графіка користувачу ${user.telegram_id}:`, error.message);
      }
    }
    
    // Відправляємо в канал
    if (user.channel_id && (notifyTarget === 'channel' || notifyTarget === 'both')) {
      try {
        const { publishScheduleWithPhotoNew } = require('./publisher');
        const sentMsg = await publishScheduleWithPhotoNew(
          bot, 
          user, 
          user.region, 
          user.queue, 
          todayEvents, 
          tomorrowEvents, 
          updateContext
        );
        if (sentMsg && sentMsg.message_id) {
          usersDb.updateUserPostId(user.id, sentMsg.message_id);
        }
        console.log(`📢 Графік опубліковано в канал ${user.channel_id}`);
      } catch (channelError) {
        console.error(`Не вдалося відправити в канал ${user.channel_id}:`, channelError.message);
      }
    }
    
    // Оновлюємо стан графіків після публікації
    usersDb.updateScheduleState(
      user.id,
      newHashToday,
      newHashTomorrow,
      currentDate,
      tomorrowDate
    );
    
  } catch (error) {
    console.error(`Помилка checkUserSchedule для користувача ${user.telegram_id}:`, error);
  }
}

module.exports = {
  initScheduler,
  checkAllSchedules,
};
