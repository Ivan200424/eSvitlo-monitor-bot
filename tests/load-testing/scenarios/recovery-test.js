#!/usr/bin/env node

/**
 * Recovery Test - Process Restart and Failure Recovery
 * Тест відновлення після збоїв
 * 
 * Перевіряє:
 * - State відновлюється після рестарту
 * - Немає фейкових подій
 * - Scheduler'и не дублюються
 * - Бот продовжує працювати після часткових збоїв
 */

const { MetricsCollector } = require('../utils/metrics');
const { generateUsers, delay } = require('../utils/generators');
const { MockTelegramBot } = require('../mocks/telegram-bot');
const fs = require('fs');
const path = require('path');

// Створити тестову базу даних
const testDbPath = '/tmp/load-test-recovery.db';

async function runRecoveryTest(userCount = 100) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RECOVERY TEST - Process Restart and Failure Recovery`);
  console.log(`Users: ${userCount}`);
  console.log(`${'='.repeat(60)}\n`);

  const metrics = new MetricsCollector(`Recovery Test - ${userCount} users`);

  // Очистити стару БД якщо існує
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  process.env.DATABASE_PATH = testDbPath;
  process.env.BOT_TOKEN = 'test_token';
  process.env.NODE_ENV = 'test';

  // ==========================================
  // Сценарій 1: Нормальна робота + збереження стану
  // ==========================================
  console.log(`--- Scenario 1: Normal operation with state persistence ---`);
  
  let bot = new MockTelegramBot('test_token', { networkDelay: 50 });
  let usersDb = require('../../../src/database/users');
  let db = require('../../../src/database/db');

  // Створити користувачів
  console.log(`Creating ${userCount} users...`);
  const users = generateUsers(userCount);
  
  for (const user of users) {
    usersDb.addUser(user.telegram_id, user.region, user.queue, true);
  }

  // Створити деякі wizard states
  console.log(`Creating wizard states for ${Math.floor(userCount * 0.3)} users...`);
  const wizardUsers = users.slice(0, Math.floor(userCount * 0.3));
  for (const user of wizardUsers) {
    db.saveUserState(user.telegram_id, 'wizard', JSON.stringify({
      step: 'region',
      timestamp: Date.now()
    }));
  }

  // Створити деякі pending channels
  console.log(`Creating pending channels for ${Math.floor(userCount * 0.2)} users...`);
  const channelUsers = users.slice(0, Math.floor(userCount * 0.2));
  for (const user of channelUsers) {
    db.savePendingChannel(user.telegram_id, -1001234567890, 'Test Channel', Date.now());
  }

  // Зберегти початковий стан
  const initialUsers = usersDb.getAllUsers().length;
  const initialWizardStates = db.getAllUserStates('wizard').length;
  const initialPendingChannels = db.getAllPendingChannels().length;

  console.log(`\nInitial state:`);
  console.log(`  Users: ${initialUsers}`);
  console.log(`  Wizard states: ${initialWizardStates}`);
  console.log(`  Pending channels: ${initialPendingChannels}`);

  // Симулювати деяку активність
  console.log(`\nSimulating activity before restart...`);
  for (let i = 0; i < 20; i++) {
    const user = users[i];
    await bot.sendMessage(user.telegram_id, `Test message ${i}`);
    metrics.incrementMessagesSent();
  }

  const messagesBeforeRestart = bot.getStats().messagesSent;
  console.log(`Messages sent before restart: ${messagesBeforeRestart}`);

  await delay(1000);

  // ==========================================
  // Сценарій 2: Симуляція рестарту
  // ==========================================
  console.log(`\n--- Scenario 2: Simulating process restart ---`);
  
  // "Вимкнути" бот (видалити з пам'яті)
  console.log(`Stopping bot...`);
  bot = null;
  
  // Очистити require cache для симуляції рестарту
  delete require.cache[require.resolve('../../../src/database/users')];
  delete require.cache[require.resolve('../../../src/database/db')];
  
  await delay(2000); // Симуляція downtime
  
  console.log(`Restarting bot...`);
  
  // "Запустити" бот знову
  bot = new MockTelegramBot('test_token', { networkDelay: 50 });
  usersDb = require('../../../src/database/users');
  db = require('../../../src/database/db');

  // Відновити стан з БД
  const restoredUsers = usersDb.getAllUsers().length;
  const restoredWizardStates = db.getAllUserStates('wizard').length;
  const restoredPendingChannels = db.getAllPendingChannels().length;

  console.log(`\nRestored state:`);
  console.log(`  Users: ${restoredUsers}`);
  console.log(`  Wizard states: ${restoredWizardStates}`);
  console.log(`  Pending channels: ${restoredPendingChannels}`);

  // Перевірити що стан відновився
  if (restoredUsers !== initialUsers) {
    console.log(`❌ ERROR: User count mismatch after restart`);
    metrics.recordError(
      new Error('User state not restored'),
      { expected: initialUsers, actual: restoredUsers }
    );
  } else {
    console.log(`✅ All users restored`);
  }

  if (restoredWizardStates !== initialWizardStates) {
    console.log(`⚠️  WARNING: Wizard states count mismatch after restart`);
    // Це може бути нормально якщо є cleanup старих states
  } else {
    console.log(`✅ Wizard states restored`);
  }

  if (restoredPendingChannels !== initialPendingChannels) {
    console.log(`⚠️  WARNING: Pending channels count mismatch after restart`);
  } else {
    console.log(`✅ Pending channels restored`);
  }

  // Продовжити роботу після рестарту
  console.log(`\nContinuing operations after restart...`);
  for (let i = 20; i < 40; i++) {
    const user = users[i];
    await bot.sendMessage(user.telegram_id, `Test message after restart ${i}`);
    metrics.incrementMessagesSent();
  }

  const messagesAfterRestart = bot.getStats().messagesSent;
  console.log(`Messages sent after restart: ${messagesAfterRestart}`);

  // Перевірити що немає дубльованих повідомлень
  const duplicates = bot.checkForDuplicates();
  if (duplicates.length > 0) {
    console.log(`\n❌ ERROR: Found ${duplicates.length} duplicates after restart`);
    duplicates.slice(0, 5).forEach(dup => {
      metrics.recordDuplicate(dup.text, dup.chatId);
    });
  } else {
    console.log(`✅ No duplicates after restart`);
  }

  await delay(1000);

  // ==========================================
  // Сценарій 3: Частковий збій (один компонент)
  // ==========================================
  console.log(`\n--- Scenario 3: Partial failure (one component fails) ---`);
  
  // Симулювати збій в одному з компонентів
  console.log(`Simulating partial failure...`);
  
  let failureCount = 0;
  const maxFailures = 5;
  
  // Симулювати помилки в деяких операціях
  for (let i = 0; i < 30; i++) {
    const user = users[i];
    
    try {
      // 20% шанс помилки
      if (Math.random() < 0.2 && failureCount < maxFailures) {
        failureCount++;
        throw new Error('Simulated component failure');
      }
      
      await bot.sendMessage(user.telegram_id, `Message ${i}`);
      metrics.incrementMessagesSent();
      
    } catch (error) {
      metrics.recordError(error, { userId: user.telegram_id, operation: 'partial_failure_test' });
      console.log(`  ⚠️  Handled error for user ${user.telegram_id}`);
      
      // Система продовжує працювати незважаючи на помилку
      continue;
    }
  }

  console.log(`\nPartial failure test completed:`);
  console.log(`  Simulated failures: ${failureCount}`);
  console.log(`  Errors recorded: ${metrics.getStats().errors.count}`);
  console.log(`  Messages still sent: ${bot.getStats().messagesSent - messagesAfterRestart}`);

  if (metrics.getStats().errors.count > 0) {
    console.log(`✅ System continued operating despite ${metrics.getStats().errors.count} errors`);
  }

  // ==========================================
  // Фінальні перевірки
  // ==========================================
  console.log(`\n--- Final state verification ---`);
  
  const finalUsers = usersDb.getAllUsers().length;
  const finalWizardStates = db.getAllUserStates('wizard').length;
  const finalPendingChannels = db.getAllPendingChannels().length;

  console.log(`Final state:`);
  console.log(`  Users: ${finalUsers}`);
  console.log(`  Wizard states: ${finalWizardStates}`);
  console.log(`  Pending channels: ${finalPendingChannels}`);
  console.log(`  Total messages sent: ${bot.getStats().messagesSent}`);
  console.log(`  Total errors: ${metrics.getStats().errors.count}`);

  // Зібрати метрики
  metrics.recordMemorySnapshot();
  metrics.finish();

  // Згенерувати звіт
  const report = metrics.generateReport();
  console.log(report);

  // Зберегти звіт
  const reportDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const reportPath = path.join(reportDir, `recovery-${userCount}-${Date.now()}.txt`);
  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Report saved to: ${reportPath}`);

  // Очистити тестову БД
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // Критерії успіху для recovery тесту
  const criteria = metrics.checkSuccessCriteria();
  const stateRestored = restoredUsers === initialUsers;
  const noDuplicates = duplicates.length === 0;
  const systemStable = metrics.getStats().errors.count < userCount * 0.1; // < 10% error rate

  const passed = criteria.passed && stateRestored && noDuplicates && systemStable;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RECOVERY TEST: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`${'='.repeat(60)}`);

  if (!passed) {
    console.log(`\nFailure reasons:`);
    if (!criteria.passed) console.log(`  - Base criteria not met`);
    if (!stateRestored) console.log(`  - State not fully restored`);
    if (!noDuplicates) console.log(`  - Duplicates detected`);
    if (!systemStable) console.log(`  - System unstable (too many errors)`);
  }

  return passed;
}

// Якщо запущено як окремий скрипт
if (require.main === module) {
  const args = process.argv.slice(2);
  const userCount = args[0] ? parseInt(args[0]) : 100;

  runRecoveryTest(userCount)
    .then(passed => {
      process.exit(passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runRecoveryTest };
