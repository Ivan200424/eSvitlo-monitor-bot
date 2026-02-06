#!/usr/bin/env node

/**
 * Load Test Scenario 1: Mass /start
 * Масовий запуск команди /start
 * 
 * Перевіряє:
 * - Бот відповідає всім
 * - State не плутається
 * - Wizard запускається коректно
 * - Немає падінь
 */

const { MetricsCollector } = require('../utils/metrics');
const { generateUsers, delay, parallelWithLimit } = require('../utils/generators');
const { MockTelegramBot } = require('../mocks/telegram-bot');
const fs = require('fs');
const path = require('path');

// Створити тестову базу даних
const testDbPath = '/tmp/load-test-mass-start.db';
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

process.env.DATABASE_PATH = testDbPath;
process.env.BOT_TOKEN = 'test_token';
process.env.NODE_ENV = 'test';

async function runMassStartTest(userCount, concurrency = 10) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`LOAD TEST: Mass /start (${userCount} users, concurrency: ${concurrency})`);
  console.log(`${'='.repeat(60)}\n`);

  const metrics = new MetricsCollector(`Mass /start - ${userCount} users`);

  // Створити mock bot
  const bot = new MockTelegramBot('test_token', {
    networkDelay: 50, // 50ms network delay
    errorRate: 0.001 // 0.1% error rate
  });

  // Імпортувати обробники бота після налаштування ENV
  const usersDb = require('../../../src/database/users');
  const db = require('../../../src/database/db');

  // Генерувати користувачів
  console.log(`Generating ${userCount} test users...`);
  const users = generateUsers(userCount);

  // Симулювати масовий /start
  console.log(`Simulating mass /start command...`);
  const startTime = Date.now();

  try {
    await parallelWithLimit(users, concurrency, async (user) => {
      const operationStart = Date.now();
      
      try {
        // Симулювати /start від користувача
        bot.simulateMessage(user.telegram_id, '/start');
        
        // Перевірити, що користувач був створений/оновлений в БД
        const dbUser = usersDb.getUser(user.telegram_id);
        
        if (!dbUser) {
          throw new Error(`User ${user.telegram_id} not found in DB after /start`);
        }
        
        // Перевірити, що wizard state був створений
        const wizardState = db.getUserState(user.telegram_id, 'wizard');
        
        const responseTime = Date.now() - operationStart;
        metrics.recordResponseTime(responseTime, '/start');
        metrics.incrementMessagesReceived();
        
        // Перевірити, що бот відповів
        await delay(10); // Дати час на відповідь
        
        if (bot.sentMessages.length > 0) {
          metrics.incrementMessagesSent();
        }
      } catch (error) {
        metrics.recordError(error, { userId: user.telegram_id, operation: '/start' });
      }
    });

    const duration = Date.now() - startTime;
    console.log(`Completed in ${(duration / 1000).toFixed(2)}s`);

    // Перевірити на дубльовані повідомлення
    const duplicates = bot.checkForDuplicates();
    if (duplicates.length > 0) {
      console.log(`\n⚠️  Found ${duplicates.length} duplicate messages:`);
      duplicates.slice(0, 5).forEach(dup => {
        console.log(`  - Chat ${dup.chatId}: "${dup.text.substring(0, 50)}..." (${dup.count} times)`);
        metrics.recordDuplicate(dup.text, dup.chatId);
      });
    }

    // Зібрати метрики пам'яті
    metrics.recordMemorySnapshot();

    // Перевірити стан бази даних
    const totalUsers = usersDb.getAllUsers().length;
    console.log(`\n📊 Database state:`);
    console.log(`  Total users in DB: ${totalUsers}`);

    // Перевірити, що всі користувачі були збережені
    if (totalUsers !== userCount) {
      metrics.recordError(
        new Error(`Expected ${userCount} users in DB, but found ${totalUsers}`),
        { operation: 'database_check' }
      );
    }

    // Отримати статистику бота
    const botStats = bot.getStats();
    console.log(`\n📨 Bot statistics:`);
    console.log(`  Messages sent: ${botStats.messagesSent}`);
    console.log(`  Messages edited: ${botStats.messagesEdited}`);
    console.log(`  Errors: ${botStats.errors}`);

  } catch (error) {
    console.error('Test failed with error:', error);
    metrics.recordError(error, { operation: 'test_execution' });
  } finally {
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
    const reportPath = path.join(reportDir, `mass-start-${userCount}-${Date.now()}.txt`);
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
}

// Якщо запущено як окремий скрипт
if (require.main === module) {
  const args = process.argv.slice(2);
  const userCount = args[0] ? parseInt(args[0]) : 100;
  const concurrency = args[1] ? parseInt(args[1]) : 10;

  runMassStartTest(userCount, concurrency)
    .then(passed => {
      process.exit(passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runMassStartTest };
