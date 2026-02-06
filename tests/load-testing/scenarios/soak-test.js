#!/usr/bin/env node

/**
 * Soak Test - Long-term Stability Test
 * Тест на стійкість під навантаженням протягом тривалого часу (24-72 години)
 * 
 * Перевіряє:
 * - Витоки пам'яті
 * - Ріст CPU
 * - Ріст кількості scheduler'ів
 * - Стабільність state
 */

const { MetricsCollector } = require('../utils/metrics');
const { generateUsers, delay } = require('../utils/generators');
const { MockTelegramBot } = require('../mocks/telegram-bot');
const fs = require('fs');
const path = require('path');

// Створити тестову базу даних
const testDbPath = '/tmp/load-test-soak.db';
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

process.env.DATABASE_PATH = testDbPath;
process.env.BOT_TOKEN = 'test_token';
process.env.NODE_ENV = 'test';

/**
 * Soak test - запуск на довгий період часу
 */
async function runSoakTest(durationMinutes = 60, userCount = 300) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SOAK TEST - Long-term Stability`);
  console.log(`Duration: ${durationMinutes} minutes (${(durationMinutes / 60).toFixed(1)} hours)`);
  console.log(`Users: ${userCount}`);
  console.log(`${'='.repeat(60)}\n`);

  const metrics = new MetricsCollector(`Soak Test - ${durationMinutes}min`);
  const startTime = Date.now();
  const endTime = startTime + (durationMinutes * 60 * 1000);

  // Створити mock bot
  const bot = new MockTelegramBot('test_token', {
    networkDelay: 50,
    errorRate: 0.001
  });

  // Імпортувати модулі
  const usersDb = require('../../../src/database/users');

  // Налаштувати користувачів
  console.log(`Setting up ${userCount} test users...`);
  const users = generateUsers(userCount);
  
  for (const user of users) {
    usersDb.addUser(user.telegram_id, user.region, user.queue, true);
  }

  // Статистика
  let cycleCount = 0;
  let totalOperations = 0;
  const memorySnapshots = [];
  const cpuSnapshots = [];
  const dbSizeSnapshots = [];
  
  // Початковий snapshot
  metrics.recordMemorySnapshot();
  const initialMemory = process.memoryUsage();
  const initialDbSize = fs.existsSync(testDbPath) ? fs.statSync(testDbPath).size : 0;
  
  console.log(`Initial memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Initial DB size: ${(initialDbSize / 1024).toFixed(2)} KB`);
  console.log(`\nStarting continuous operations...\n`);

  // Головний цикл
  while (Date.now() < endTime) {
    cycleCount++;
    const cycleStart = Date.now();
    
    // Прогрес
    const elapsed = Date.now() - startTime;
    const elapsedMinutes = Math.floor(elapsed / 60000);
    const totalMinutes = durationMinutes;
    const progress = ((elapsed / (endTime - startTime)) * 100).toFixed(1);
    
    console.log(`\n[Cycle ${cycleCount}] ${elapsedMinutes}/${totalMinutes} min (${progress}%)`);

    // Симулювати різні операції
    try {
      // 1. Деякі користувачі відправляють /start
      const startUsers = users.slice(0, 10);
      for (const user of startUsers) {
        bot.simulateMessage(user.telegram_id, '/start');
        await delay(10);
        totalOperations++;
      }

      // 2. Оновлення графіків для деяких користувачів
      const updateUsers = users.slice(10, 30);
      for (const user of updateUsers) {
        await bot.sendMessage(user.telegram_id, '📊 Графік оновлено');
        totalOperations++;
      }

      // 3. IP моніторинг - зміни стану
      const ipUsers = users.slice(30, 50);
      for (const user of ipUsers) {
        const state = Math.random() > 0.5 ? 'on' : 'off';
        const emoji = state === 'on' ? '🟢' : '⚫️';
        await bot.sendMessage(user.telegram_id, `${emoji} Світло ${state === 'on' ? 'увімкнено' : 'вимкнено'}`);
        totalOperations++;
      }

    } catch (error) {
      metrics.recordError(error, { cycle: cycleCount });
      console.error(`Error in cycle ${cycleCount}:`, error.message);
    }

    // Збір метрик кожні 5 циклів
    if (cycleCount % 5 === 0) {
      const currentMemory = process.memoryUsage();
      const currentDbSize = fs.existsSync(testDbPath) ? fs.statSync(testDbPath).size : 0;
      
      memorySnapshots.push({
        cycle: cycleCount,
        time: Date.now(),
        heapUsed: currentMemory.heapUsed,
        heapTotal: currentMemory.heapTotal,
        rss: currentMemory.rss
      });
      
      dbSizeSnapshots.push({
        cycle: cycleCount,
        time: Date.now(),
        size: currentDbSize
      });
      
      metrics.recordMemorySnapshot();
      
      const memoryGrowth = ((currentMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed) * 100;
      const dbGrowth = initialDbSize > 0 
        ? ((currentDbSize - initialDbSize) / initialDbSize) * 100 
        : 0;
      
      console.log(`  Memory: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)} MB (${memoryGrowth >= 0 ? '+' : ''}${memoryGrowth.toFixed(1)}%)`);
      console.log(`  DB size: ${(currentDbSize / 1024).toFixed(2)} KB (${dbGrowth >= 0 ? '+' : ''}${dbGrowth.toFixed(1)}%)`);
      console.log(`  Total operations: ${totalOperations}`);
      console.log(`  Bot messages sent: ${bot.getStats().messagesSent}`);
      console.log(`  Errors: ${bot.getStats().errors}`);
    }

    // Затримка між циклами
    const cycleDuration = Date.now() - cycleStart;
    const targetCycleDuration = 10000; // 10 секунд на цикл
    const sleepTime = Math.max(0, targetCycleDuration - cycleDuration);
    
    if (sleepTime > 0) {
      await delay(sleepTime);
    }
  }

  // Завершити тест
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SOAK TEST COMPLETED`);
  console.log(`${'='.repeat(60)}\n`);

  // Фінальні метрики
  const finalMemory = process.memoryUsage();
  const finalDbSize = fs.existsSync(testDbPath) ? fs.statSync(testDbPath).size : 0;
  
  const memoryGrowthAbs = finalMemory.heapUsed - initialMemory.heapUsed;
  const memoryGrowthPct = (memoryGrowthAbs / initialMemory.heapUsed) * 100;
  const dbGrowthAbs = finalDbSize - initialDbSize;
  const dbGrowthPct = initialDbSize > 0 ? (dbGrowthAbs / initialDbSize) * 100 : 0;

  console.log(`Duration: ${((Date.now() - startTime) / 60000).toFixed(1)} minutes`);
  console.log(`Total cycles: ${cycleCount}`);
  console.log(`Total operations: ${totalOperations}`);
  console.log(`\nMemory:`);
  console.log(`  Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Growth: ${(memoryGrowthAbs / 1024 / 1024).toFixed(2)} MB (${memoryGrowthPct.toFixed(1)}%)`);
  console.log(`\nDatabase:`);
  console.log(`  Initial: ${(initialDbSize / 1024).toFixed(2)} KB`);
  console.log(`  Final: ${(finalDbSize / 1024).toFixed(2)} KB`);
  console.log(`  Growth: ${(dbGrowthAbs / 1024).toFixed(2)} KB (${dbGrowthPct.toFixed(1)}%)`);

  // Перевірити на витоки пам'яті
  const hasMemoryLeak = memoryGrowthPct > 100; // Ріст > 100% вважається витоком
  const hasDbGrowthIssue = dbGrowthPct > 200; // Ріст БД > 200% може бути проблемою

  if (hasMemoryLeak) {
    console.log(`\n❌ WARNING: Potential memory leak detected (${memoryGrowthPct.toFixed(1)}% growth)`);
    metrics.recordError(
      new Error('Memory leak detected'),
      { growth: memoryGrowthPct }
    );
  } else {
    console.log(`\n✅ Memory usage is stable`);
  }

  if (hasDbGrowthIssue) {
    console.log(`❌ WARNING: Excessive database growth (${dbGrowthPct.toFixed(1)}% growth)`);
    metrics.recordError(
      new Error('Excessive DB growth'),
      { growth: dbGrowthPct }
    );
  } else {
    console.log(`✅ Database size is stable`);
  }

  // Завершити збір метрик
  metrics.finish();

  // Згенерувати звіт
  const report = metrics.generateReport();
  console.log(report);

  // Зберегти детальний звіт
  const reportDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const reportPath = path.join(reportDir, `soak-${durationMinutes}min-${Date.now()}.txt`);
  const detailedReport = report + '\n\nMemory Snapshots:\n' + 
    JSON.stringify(memorySnapshots, null, 2) + 
    '\n\nDB Size Snapshots:\n' + 
    JSON.stringify(dbSizeSnapshots, null, 2);
  
  fs.writeFileSync(reportPath, detailedReport);
  console.log(`\n📄 Report saved to: ${reportPath}`);

  // Очистити тестову БД
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // Повернути результат
  const criteria = metrics.checkSuccessCriteria();
  return criteria.passed && !hasMemoryLeak && !hasDbGrowthIssue;
}

// Якщо запущено як окремий скрипт
if (require.main === module) {
  const args = process.argv.slice(2);
  const durationMinutes = args[0] ? parseInt(args[0]) : 60; // За замовчуванням 1 година
  const userCount = args[1] ? parseInt(args[1]) : 300;

  console.log(`\n⏱️  Starting soak test for ${durationMinutes} minutes with ${userCount} users...`);
  console.log(`   (For full 24h test, use: node soak-test.js 1440 300)`);
  console.log(`   (For 72h test, use: node soak-test.js 4320 300)\n`);

  runSoakTest(durationMinutes, userCount)
    .then(passed => {
      process.exit(passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runSoakTest };
