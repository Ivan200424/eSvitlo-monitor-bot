#!/usr/bin/env node

/**
 * Load Test Scenario 3: Mass Graph Updates
 * Масові оновлення графіків
 * 
 * Перевіряє:
 * - Немає дубльованих публікацій
 * - Hash-порівняння стабільне
 * - Бот не спамить
 */

const { MetricsCollector } = require('../utils/metrics');
const { generateUsers, generateScheduleData, delay, parallelWithLimit } = require('../utils/generators');
const { MockTelegramBot } = require('../mocks/telegram-bot');
const fs = require('fs');
const path = require('path');

// Створити тестову базу даних
const testDbPath = '/tmp/load-test-mass-graphs.db';
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

process.env.DATABASE_PATH = testDbPath;
process.env.BOT_TOKEN = 'test_token';
process.env.NODE_ENV = 'test';

async function runMassGraphUpdatesTest(userCount, updateRounds = 5) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`LOAD TEST: Mass Graph Updates (${userCount} users, ${updateRounds} rounds)`);
  console.log(`${'='.repeat(60)}\n`);

  const metrics = new MetricsCollector(`Mass Graph Updates - ${userCount} users`);

  // Створити mock bot
  const bot = new MockTelegramBot('test_token', {
    networkDelay: 100, // 100ms network delay для публікацій
    errorRate: 0.002 // 0.2% error rate
  });

  // Імпортувати модулі після налаштування ENV
  const usersDb = require('../../../src/database/users');
  const { calculateSchedulePeriodsHash } = require('../../../src/utils');

  // Генерувати користувачів та зберегти в БД
  console.log(`Setting up ${userCount} test users...`);
  const users = generateUsers(userCount);
  
  for (const user of users) {
    usersDb.addUser(
      user.telegram_id,
      user.region,
      user.queue,
      user.notification_enabled
    );
  }

  // Зберегти початкові графіки для всіх користувачів
  const initialSchedule = generateScheduleData('kyiv');
  
  console.log(`Publishing initial schedules...`);
  const messagesBeforeUpdate = bot.sentMessages.length;
  
  for (const user of users) {
    const dbUser = usersDb.getUser(user.telegram_id);
    // Симулювати перший запис графіку
    const hash = calculateSchedulePeriodsHash(initialSchedule, user.queue);
    usersDb.updateScheduleHash(dbUser.id, hash, null);
    
    // Симулювати відправку повідомлення
    await bot.sendMessage(user.telegram_id, `📊 Графік для черги ${user.queue}`);
    metrics.incrementMessagesSent();
  }
  
  console.log(`Initial messages sent: ${bot.sentMessages.length - messagesBeforeUpdate}`);

  // Запустити раунди оновлень
  console.log(`\nRunning ${updateRounds} update rounds...`);
  
  for (let round = 1; round <= updateRounds; round++) {
    console.log(`\n--- Round ${round}/${updateRounds} ---`);
    const roundStart = Date.now();
    
    // 50% шанс що графік змінився
    const scheduleChanged = Math.random() > 0.5;
    const newSchedule = scheduleChanged ? generateScheduleData('kyiv') : initialSchedule;
    
    console.log(`Schedule ${scheduleChanged ? 'CHANGED' : 'UNCHANGED'}`);
    
    const messagesBeforeRound = bot.sentMessages.length;
    let expectedUpdates = 0;
    
    // Обробити кожного користувача
    await parallelWithLimit(users, 50, async (user) => {
      const operationStart = Date.now();
      
      try {
        const dbUser = usersDb.getUser(user.telegram_id);
        const newHash = calculateSchedulePeriodsHash(newSchedule, user.queue);
        const oldHash = dbUser.schedule_hash_today;
        
        // Якщо хеш змінився - відправити оновлення
        if (newHash !== oldHash) {
          await bot.sendMessage(
            user.telegram_id,
            `📊 Графік оновлено для черги ${user.queue} (round ${round})`
          );
          usersDb.updateScheduleHash(dbUser.id, newHash, null);
          metrics.incrementMessagesSent();
          expectedUpdates++;
        }
        
        const responseTime = Date.now() - operationStart;
        metrics.recordResponseTime(responseTime, 'graph_update');
      } catch (error) {
        metrics.recordError(error, { 
          userId: user.telegram_id, 
          operation: 'graph_update',
          round
        });
      }
    });
    
    const messagesInRound = bot.sentMessages.length - messagesBeforeRound;
    const roundDuration = Date.now() - roundStart;
    
    console.log(`Round ${round} completed in ${(roundDuration / 1000).toFixed(2)}s`);
    console.log(`Messages sent: ${messagesInRound} (expected: ${expectedUpdates})`);
    
    // Перевірити чи не надіслано зайвих повідомлень
    if (messagesInRound > expectedUpdates) {
      const extraMessages = messagesInRound - expectedUpdates;
      console.log(`⚠️  WARNING: ${extraMessages} extra messages sent (possible duplicates or spam)`);
      metrics.recordError(
        new Error(`Round ${round}: ${extraMessages} unexpected messages`),
        { round, expectedUpdates, actualMessages: messagesInRound }
      );
    }
    
    // Якщо графік не змінився, не повинно бути жодних повідомлень
    if (!scheduleChanged && messagesInRound > 0) {
      console.log(`❌ ERROR: ${messagesInRound} messages sent for unchanged schedule!`);
      metrics.recordError(
        new Error(`Round ${round}: Messages sent for unchanged schedule`),
        { round, messages: messagesInRound }
      );
    }
    
    // Затримка між раундами
    await delay(1000);
  }

  // Перевірити на дубльовані повідомлення
  console.log(`\nChecking for duplicates...`);
  const duplicates = bot.checkForDuplicates();
  if (duplicates.length > 0) {
    console.log(`\n⚠️  Found ${duplicates.length} duplicate messages:`);
    duplicates.slice(0, 10).forEach(dup => {
      console.log(`  - Chat ${dup.chatId}: "${dup.text.substring(0, 50)}..." (${dup.count} times)`);
      metrics.recordDuplicate(dup.text, dup.chatId);
    });
  } else {
    console.log(`✅ No duplicates found`);
  }

  // Зібрати метрики пам'яті
  metrics.recordMemorySnapshot();

  // Отримати статистику бота
  const botStats = bot.getStats();
  console.log(`\n📨 Bot statistics:`);
  console.log(`  Messages sent: ${botStats.messagesSent}`);
  console.log(`  Errors: ${botStats.errors}`);

  // Завершити збір метрик
  metrics.finish();

  // Згенерувати звіт
  const report = metrics.generateReport();
  console.log(report);

  // Зберегти звіт
  const reportDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const reportPath = path.join(reportDir, `mass-graphs-${userCount}-${Date.now()}.txt`);
  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Report saved to: ${reportPath}`);

  // Очистити тестову БД
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // Повернути результат
  const criteria = metrics.checkSuccessCriteria();
  return criteria.passed;
}

// Якщо запущено як окремий скрипт
if (require.main === module) {
  const args = process.argv.slice(2);
  const userCount = args[0] ? parseInt(args[0]) : 100;
  const updateRounds = args[1] ? parseInt(args[1]) : 5;

  runMassGraphUpdatesTest(userCount, updateRounds)
    .then(passed => {
      process.exit(passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runMassGraphUpdatesTest };
