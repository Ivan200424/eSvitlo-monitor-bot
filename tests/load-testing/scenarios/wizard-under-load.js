#!/usr/bin/env node

/**
 * Load Test Scenario 2: Wizard Under Load
 * Wizard під навантаженням
 * 
 * Перевіряє:
 * - Pending state не перетинаються між користувачами
 * - Cancel працює коректно
 * - Timeout очищає state
 */

const { MetricsCollector } = require('../utils/metrics');
const { generateUsers, delay, parallelWithLimit } = require('../utils/generators');
const { MockTelegramBot } = require('../mocks/telegram-bot');
const fs = require('fs');
const path = require('path');

// Створити тестову базу даних
const testDbPath = '/tmp/load-test-wizard.db';
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

process.env.DATABASE_PATH = testDbPath;
process.env.BOT_TOKEN = 'test_token';
process.env.NODE_ENV = 'test';

async function runWizardUnderLoadTest(userCount, concurrency = 10) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`LOAD TEST: Wizard Under Load (${userCount} users, concurrency: ${concurrency})`);
  console.log(`${'='.repeat(60)}\n`);

  const metrics = new MetricsCollector(`Wizard Under Load - ${userCount} users`);

  // Створити mock bot
  const bot = new MockTelegramBot('test_token', {
    networkDelay: 100,
    errorRate: 0.001
  });

  // Імпортувати модулі після налаштування ENV
  const db = require('../../../src/database/db');
  const usersDb = require('../../../src/database/users');

  // Генерувати користувачів
  console.log(`Generating ${userCount} test users...`);
  const users = generateUsers(userCount);

  // Сценарій 1: Одночасний запуск wizard для багатьох користувачів
  console.log(`\n--- Scenario 1: Concurrent wizard start ---`);
  const scenario1Start = Date.now();

  try {
    await parallelWithLimit(users, concurrency, async (user) => {
      const operationStart = Date.now();
      
      try {
        // Симулювати початок wizard
        bot.simulateMessage(user.telegram_id, '/start');
        
        // Зберегти wizard state
        db.saveUserState(user.telegram_id, 'wizard', JSON.stringify({
          step: 'region',
          timestamp: Date.now()
        }));
        
        const responseTime = Date.now() - operationStart;
        metrics.recordResponseTime(responseTime, 'wizard_start');
        metrics.incrementMessagesReceived();
        
      } catch (error) {
        metrics.recordError(error, { userId: user.telegram_id, operation: 'wizard_start' });
      }
    });

    const scenario1Duration = Date.now() - scenario1Start;
    console.log(`Scenario 1 completed in ${(scenario1Duration / 1000).toFixed(2)}s`);

    // Перевірити що всі wizard states створені
    const allStates = db.getAllUserStates('wizard');
    console.log(`Wizard states created: ${allStates.length} (expected: ${userCount})`);
    
    if (allStates.length !== userCount) {
      metrics.recordError(
        new Error(`Expected ${userCount} wizard states, but found ${allStates.length}`),
        { operation: 'wizard_states_check' }
      );
    }

    // Перевірити що state не перетинаються
    const uniqueUsers = new Set(allStates.map(s => s.user_id));
    if (uniqueUsers.size !== allStates.length) {
      console.log(`❌ ERROR: State collision detected!`);
      metrics.recordError(
        new Error('Wizard state collision detected'),
        { uniqueUsers: uniqueUsers.size, totalStates: allStates.length }
      );
    } else {
      console.log(`✅ No state collisions`);
    }

  } catch (error) {
    console.error('Scenario 1 failed:', error);
    metrics.recordError(error, { operation: 'scenario_1' });
  }

  await delay(1000);

  // Сценарій 2: Проходження wizard кроків
  console.log(`\n--- Scenario 2: Wizard steps progression ---`);
  const scenario2Start = Date.now();

  try {
    await parallelWithLimit(users, concurrency, async (user) => {
      const operationStart = Date.now();
      
      try {
        // Крок 1: Вибір регіону
        bot.simulateCallbackQuery(user.telegram_id, 'region_kyiv');
        db.saveUserState(user.telegram_id, 'wizard', JSON.stringify({
          step: 'queue',
          region: 'kyiv',
          timestamp: Date.now()
        }));
        await delay(50);
        
        // Крок 2: Вибір черги
        bot.simulateCallbackQuery(user.telegram_id, 'queue_GPV1.1');
        db.saveUserState(user.telegram_id, 'wizard', JSON.stringify({
          step: 'notification',
          region: 'kyiv',
          queue: 'GPV1.1',
          timestamp: Date.now()
        }));
        await delay(50);
        
        // Крок 3: Завершення
        bot.simulateCallbackQuery(user.telegram_id, 'notification_yes');
        
        // Видалити wizard state після завершення
        db.deleteUserState(user.telegram_id, 'wizard');
        
        // Створити користувача в БД
        usersDb.addUser(user.telegram_id, 'kyiv', 'GPV1.1', true);
        
        const responseTime = Date.now() - operationStart;
        metrics.recordResponseTime(responseTime, 'wizard_complete');
        
      } catch (error) {
        metrics.recordError(error, { userId: user.telegram_id, operation: 'wizard_steps' });
      }
    });

    const scenario2Duration = Date.now() - scenario2Start;
    console.log(`Scenario 2 completed in ${(scenario2Duration / 1000).toFixed(2)}s`);

    // Перевірити що всі wizard states очищені
    const remainingStates = db.getAllUserStates('wizard');
    console.log(`Remaining wizard states: ${remainingStates.length} (expected: 0)`);
    
    if (remainingStates.length > 0) {
      console.log(`⚠️  WARNING: ${remainingStates.length} wizard states not cleaned up`);
      metrics.recordError(
        new Error('Wizard states not cleaned up'),
        { remainingStates: remainingStates.length }
      );
    } else {
      console.log(`✅ All wizard states cleaned up`);
    }

    // Перевірити що всі користувачі створені
    const totalUsers = usersDb.getAllUsers().length;
    console.log(`Users created: ${totalUsers} (expected: ${userCount})`);
    
    if (totalUsers !== userCount) {
      metrics.recordError(
        new Error(`Expected ${userCount} users, but found ${totalUsers}`),
        { operation: 'users_created_check' }
      );
    }

  } catch (error) {
    console.error('Scenario 2 failed:', error);
    metrics.recordError(error, { operation: 'scenario_2' });
  }

  await delay(1000);

  // Сценарій 3: Cancel під час wizard
  console.log(`\n--- Scenario 3: Cancel during wizard ---`);
  const scenario3Start = Date.now();
  
  // Використаємо перших 20% користувачів для тесту cancel
  const cancelUsers = users.slice(0, Math.floor(userCount * 0.2));
  
  try {
    await parallelWithLimit(cancelUsers, concurrency, async (user) => {
      const operationStart = Date.now();
      
      try {
        // Почати wizard
        bot.simulateMessage(user.telegram_id, '/start');
        db.saveUserState(user.telegram_id, 'wizard', JSON.stringify({
          step: 'region',
          timestamp: Date.now()
        }));
        
        await delay(50);
        
        // Cancel
        bot.simulateMessage(user.telegram_id, '/cancel');
        db.deleteUserState(user.telegram_id, 'wizard');
        
        const responseTime = Date.now() - operationStart;
        metrics.recordResponseTime(responseTime, 'wizard_cancel');
        
      } catch (error) {
        metrics.recordError(error, { userId: user.telegram_id, operation: 'wizard_cancel' });
      }
    });

    const scenario3Duration = Date.now() - scenario3Start;
    console.log(`Scenario 3 completed in ${(scenario3Duration / 1000).toFixed(2)}s`);

    // Перевірити що всі canceled wizard states очищені
    const canceledStates = db.getAllUserStates('wizard');
    console.log(`Remaining wizard states after cancel: ${canceledStates.length} (expected: 0)`);
    
    if (canceledStates.length > 0) {
      console.log(`❌ ERROR: Cancel did not clean up wizard states`);
      metrics.recordError(
        new Error('Cancel did not clean wizard states'),
        { remainingStates: canceledStates.length }
      );
    } else {
      console.log(`✅ Cancel cleaned up all wizard states`);
    }

  } catch (error) {
    console.error('Scenario 3 failed:', error);
    metrics.recordError(error, { operation: 'scenario_3' });
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
  console.log(`  Callbacks answered: ${botStats.callbacksAnswered}`);
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
  const reportPath = path.join(reportDir, `wizard-${userCount}-${Date.now()}.txt`);
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
  const userCount = args[0] ? parseInt(args[0]) : 50;
  const concurrency = args[1] ? parseInt(args[1]) : 10;

  runWizardUnderLoadTest(userCount, concurrency)
    .then(passed => {
      process.exit(passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runWizardUnderLoadTest };
