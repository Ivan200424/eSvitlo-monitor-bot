#!/usr/bin/env node

/**
 * Standalone Load Test - without requiring bot modules
 * Simplified test that validates the load testing framework itself
 */

const { MetricsCollector } = require('./utils/metrics');
const { generateUsers, generateLoadData, LOAD_LEVELS, delay, parallelWithLimit } = require('./utils/generators');
const { MockTelegramBot } = require('./mocks/telegram-bot');
const fs = require('fs');
const path = require('path');

async function runStandaloneTest(level = 'SMALL') {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`STANDALONE LOAD TEST - ${level} LEVEL`);
  console.log(`${'='.repeat(60)}\n`);

  const loadConfig = LOAD_LEVELS[level];
  const metrics = new MetricsCollector(`Standalone Test - ${level}`);

  // Створити mock bot
  const bot = new MockTelegramBot('test_token', {
    networkDelay: 50,
    errorRate: 0.001
  });

  // Генерувати дані
  console.log(`Generating test data for ${level} level...`);
  const data = generateLoadData(level);
  console.log(`  Users: ${data.users.length}`);
  console.log(`  Channels: ${data.channels.length}`);
  console.log(`  IPs: ${data.ips.length}`);

  // Тест 1: Масове надсилання повідомлень
  console.log(`\n--- Test 1: Mass message sending ---`);
  const test1Start = Date.now();

  await parallelWithLimit(data.users, 10, async (user) => {
    const operationStart = Date.now();
    
    try {
      // Симулювати надсилання повідомлення
      await bot.sendMessage(user.telegram_id, `Welcome! Region: ${user.region}, Queue: ${user.queue}`);
      
      const responseTime = Date.now() - operationStart;
      metrics.recordResponseTime(responseTime, 'send_message');
      metrics.incrementMessagesSent();
      
    } catch (error) {
      metrics.recordError(error, { userId: user.telegram_id });
    }
  });

  const test1Duration = Date.now() - test1Start;
  console.log(`Test 1 completed in ${(test1Duration / 1000).toFixed(2)}s`);
  console.log(`Messages sent: ${bot.getStats().messagesSent}`);

  // Тест 2: Callback queries
  console.log(`\n--- Test 2: Callback queries ---`);
  const test2Start = Date.now();

  await parallelWithLimit(data.users.slice(0, 50), 10, async (user) => {
    const operationStart = Date.now();
    
    try {
      // Симулювати callback query
      bot.simulateCallbackQuery(user.telegram_id, `action_${user.region}_${user.queue}`);
      await bot.answerCallbackQuery('callback_' + user.telegram_id, { text: 'OK' });
      
      const responseTime = Date.now() - operationStart;
      metrics.recordResponseTime(responseTime, 'callback_query');
      
    } catch (error) {
      metrics.recordError(error, { userId: user.telegram_id });
    }
  });

  const test2Duration = Date.now() - test2Start;
  console.log(`Test 2 completed in ${(test2Duration / 1000).toFixed(2)}s`);
  console.log(`Callbacks answered: ${bot.getStats().callbacksAnswered}`);

  // Тест 3: Редагування повідомлень
  console.log(`\n--- Test 3: Message editing ---`);
  const test3Start = Date.now();

  await parallelWithLimit(data.users.slice(0, 30), 10, async (user) => {
    const operationStart = Date.now();
    
    try {
      // Надіслати повідомлення
      const msg = await bot.sendMessage(user.telegram_id, 'Original message');
      await delay(10);
      
      // Редагувати повідомлення
      await bot.editMessageText('Updated message', {
        chat_id: user.telegram_id,
        message_id: msg.message_id
      });
      
      const responseTime = Date.now() - operationStart;
      metrics.recordResponseTime(responseTime, 'edit_message');
      metrics.incrementMessagesSent();
      
    } catch (error) {
      metrics.recordError(error, { userId: user.telegram_id });
    }
  });

  const test3Duration = Date.now() - test3Start;
  console.log(`Test 3 completed in ${(test3Duration / 1000).toFixed(2)}s`);
  console.log(`Messages edited: ${bot.getStats().messagesEdited}`);

  // Перевірити на дубльовані повідомлення
  console.log(`\n--- Checking for duplicates ---`);
  const duplicates = bot.checkForDuplicates();
  if (duplicates.length > 0) {
    console.log(`⚠️  Found ${duplicates.length} duplicate messages:`);
    duplicates.slice(0, 5).forEach(dup => {
      console.log(`  - Chat ${dup.chatId}: "${dup.text.substring(0, 50)}..." (${dup.count} times)`);
      metrics.recordDuplicate(dup.text, dup.chatId);
    });
  } else {
    console.log(`✅ No duplicates found`);
  }

  // Зібрати метрики
  metrics.recordMemorySnapshot();
  
  const botStats = bot.getStats();
  console.log(`\n--- Bot statistics ---`);
  console.log(`  Messages sent: ${botStats.messagesSent}`);
  console.log(`  Messages edited: ${botStats.messagesEdited}`);
  console.log(`  Messages deleted: ${botStats.messagesDeleted}`);
  console.log(`  Callbacks answered: ${botStats.callbacksAnswered}`);
  console.log(`  Errors: ${botStats.errors}`);

  // Завершити збір метрик
  metrics.finish();

  // Згенерувати звіт
  const report = metrics.generateReport();
  console.log(report);

  // Зберегти звіт
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const reportPath = path.join(reportDir, `standalone-${level.toLowerCase()}-${Date.now()}.txt`);
  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Report saved to: ${reportPath}`);

  // Повернути результат
  const criteria = metrics.checkSuccessCriteria();
  return criteria.passed;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const level = args[0] ? args[0].toUpperCase() : 'SMALL';

  if (!LOAD_LEVELS[level]) {
    console.error(`Invalid level: ${level}`);
    console.log('Available levels: SMALL, MEDIUM, HIGH, STRESS');
    process.exit(1);
  }

  runStandaloneTest(level)
    .then(passed => {
      process.exit(passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runStandaloneTest };
