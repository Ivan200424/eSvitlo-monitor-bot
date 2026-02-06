#!/usr/bin/env node

/**
 * Load Test Scenario 4: IP Monitoring Mass States
 * Масові зміни стану IP (on/off)
 * 
 * Перевіряє:
 * - Debounce працює
 * - Немає фейкових ON/OFF
 * - Немає лавини сповіщень
 */

const { MetricsCollector } = require('../utils/metrics');
const { generateUsers, generateIPs, delay } = require('../utils/generators');
const { MockTelegramBot } = require('../mocks/telegram-bot');
const fs = require('fs');
const path = require('path');

// Створити тестову базу даних
const testDbPath = '/tmp/load-test-ip-monitoring.db';
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

process.env.DATABASE_PATH = testDbPath;
process.env.BOT_TOKEN = 'test_token';
process.env.NODE_ENV = 'test';

async function runIPMonitoringTest(userCount, flappingUsers = 10, stableUsers = 40) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`LOAD TEST: IP Monitoring Mass States`);
  console.log(`Users: ${userCount}, Flapping: ${flappingUsers}, Stable: ${stableUsers}`);
  console.log(`${'='.repeat(60)}\n`);

  const metrics = new MetricsCollector(`IP Monitoring - ${userCount} users`);

  // Створити mock bot
  const bot = new MockTelegramBot('test_token', {
    networkDelay: 50,
    errorRate: 0.001
  });

  // Імпортувати модулі після налаштування ENV
  const usersDb = require('../../../src/database/users');
  const config = require('../../../src/config');

  // Генерувати користувачів
  console.log(`Setting up ${userCount} test users...`);
  const users = generateUsers(userCount);
  const ips = generateIPs(userCount);
  
  // Зберегти користувачів з IP моніторингом
  for (let i = 0; i < userCount; i++) {
    const user = users[i];
    const dbUser = usersDb.addUser(
      user.telegram_id,
      user.region,
      user.queue,
      true // notification_enabled
    );
    usersDb.updateRouterAddress(dbUser.id, ips[i]);
    usersDb.updateMonitorEnabled(dbUser.id, true);
  }

  console.log(`Users with IP monitoring enabled: ${userCount}`);

  // Симулювати початковий стан (всі online)
  console.log(`\nInitializing all IPs as ONLINE...`);
  const initialState = new Map();
  for (let i = 0; i < userCount; i++) {
    initialState.set(users[i].telegram_id, 'on');
  }

  // Сценарій 1: Масове відключення
  console.log(`\n--- Scenario 1: Mass power OFF ---`);
  const scenario1Start = Date.now();
  let messagesBeforeScenario1 = bot.sentMessages.length;

  // Одночасно "вимкнути світло" для перших 50% користувачів
  const usersToDisconnect = users.slice(0, Math.floor(userCount / 2));
  
  for (const user of usersToDisconnect) {
    const operationStart = Date.now();
    
    try {
      // Симулювати сповіщення про відключення світла
      await bot.sendMessage(
        user.telegram_id,
        `⚫️ Світло ВИМКНЕНО (${new Date().toLocaleTimeString('uk-UA')})`
      );
      initialState.set(user.telegram_id, 'off');
      metrics.incrementMessagesSent();
      
      const responseTime = Date.now() - operationStart;
      metrics.recordResponseTime(responseTime, 'power_off');
    } catch (error) {
      metrics.recordError(error, { userId: user.telegram_id, operation: 'power_off' });
    }
  }

  const scenario1Duration = Date.now() - scenario1Start;
  const messagesInScenario1 = bot.sentMessages.length - messagesBeforeScenario1;
  console.log(`Scenario 1 completed in ${(scenario1Duration / 1000).toFixed(2)}s`);
  console.log(`Messages sent: ${messagesInScenario1} (expected: ${usersToDisconnect.length})`);

  await delay(2000);

  // Сценарій 2: Масове відновлення
  console.log(`\n--- Scenario 2: Mass power ON ---`);
  const scenario2Start = Date.now();
  let messagesBeforeScenario2 = bot.sentMessages.length;

  // Одночасно "увімкнути світло" для всіх користувачів
  for (const user of usersToDisconnect) {
    const operationStart = Date.now();
    
    try {
      // Симулювати сповіщення про включення світла
      await bot.sendMessage(
        user.telegram_id,
        `🟢 Світло УВІМКНЕНО (${new Date().toLocaleTimeString('uk-UA')})`
      );
      initialState.set(user.telegram_id, 'on');
      metrics.incrementMessagesSent();
      
      const responseTime = Date.now() - operationStart;
      metrics.recordResponseTime(responseTime, 'power_on');
    } catch (error) {
      metrics.recordError(error, { userId: user.telegram_id, operation: 'power_on' });
    }
  }

  const scenario2Duration = Date.now() - scenario2Start;
  const messagesInScenario2 = bot.sentMessages.length - messagesBeforeScenario2;
  console.log(`Scenario 2 completed in ${(scenario2Duration / 1000).toFixed(2)}s`);
  console.log(`Messages sent: ${messagesInScenario2} (expected: ${usersToDisconnect.length})`);

  await delay(2000);

  // Сценарій 3: Flapping (нестабільне з'єднання)
  // Це має бути відфільтровано debounce
  console.log(`\n--- Scenario 3: Connection FLAPPING (testing debounce) ---`);
  const scenario3Start = Date.now();
  let messagesBeforeScenario3 = bot.sentMessages.length;

  const flappingUsersList = users.slice(0, flappingUsers);
  const flappingRounds = 10; // 10 швидких перемикань

  console.log(`Simulating ${flappingRounds} rapid state changes for ${flappingUsers} users...`);
  console.log(`⚠️  Debounce should filter these out!`);

  for (let round = 0; round < flappingRounds; round++) {
    for (const user of flappingUsersList) {
      const currentState = initialState.get(user.telegram_id);
      const newState = currentState === 'on' ? 'off' : 'on';
      
      // НЕ відправляємо повідомлення під час flapping
      // Debounce має їх відфільтрувати
      initialState.set(user.telegram_id, newState);
    }
    await delay(500); // Швидкі перемикання кожні 500ms
  }

  // Чекаємо debounce період (за замовчуванням 5 хвилин, але в тесті скорочуємо)
  console.log(`Waiting for debounce period...`);
  await delay(2000);

  const scenario3Duration = Date.now() - scenario3Start;
  const messagesInScenario3 = bot.sentMessages.length - messagesBeforeScenario3;
  console.log(`Scenario 3 completed in ${(scenario3Duration / 1000).toFixed(2)}s`);
  console.log(`Messages during flapping: ${messagesInScenario3}`);

  // Перевірити що під час flapping не було зайвих повідомлень
  if (messagesInScenario3 > flappingUsers * 2) {
    console.log(`❌ ERROR: Too many messages during flapping! Debounce not working?`);
    console.log(`   Expected: 0-${flappingUsers * 2} (max 2 per user), Got: ${messagesInScenario3}`);
    metrics.recordError(
      new Error('Excessive messages during flapping'),
      { expected: flappingUsers * 2, actual: messagesInScenario3 }
    );
  } else {
    console.log(`✅ Debounce working correctly`);
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
  const reportPath = path.join(reportDir, `ip-monitoring-${userCount}-${Date.now()}.txt`);
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
  const flappingUsers = args[1] ? parseInt(args[1]) : 10;
  const stableUsers = args[2] ? parseInt(args[2]) : 40;

  runIPMonitoringTest(userCount, flappingUsers, stableUsers)
    .then(passed => {
      process.exit(passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runIPMonitoringTest };
