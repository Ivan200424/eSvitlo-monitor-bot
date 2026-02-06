#!/usr/bin/env node

/**
 * Load Testing Main Runner
 * Запускає всі тести навантаження
 */

const path = require('path');
const fs = require('fs');

// Імпортувати сценарії
const { runMassStartTest } = require('./scenarios/mass-start');
const { runMassGraphUpdatesTest } = require('./scenarios/mass-graph-updates');
const { runIPMonitoringTest } = require('./scenarios/ip-monitoring');

// Load levels
const LOAD_LEVELS = {
  SMALL: { name: 'Small', users: 50, channels: 10, ips: 10 },
  MEDIUM: { name: 'Medium', users: 300, channels: 50, ips: 50 },
  HIGH: { name: 'High', users: 1000, channels: 200, ips: 200 },
  STRESS: { name: 'Stress', users: 5000, channels: 1000, ips: 1000 }
};

/**
 * Запустити всі тести для певного рівня навантаження
 */
async function runLoadTestsForLevel(level) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`LOAD TESTING SUITE - LEVEL: ${level.name.toUpperCase()}`);
  console.log(`Users: ${level.users}, Channels: ${level.channels}, IPs: ${level.ips}`);
  console.log(`${'='.repeat(80)}\n`);

  const results = {
    level: level.name,
    timestamp: new Date().toISOString(),
    tests: []
  };

  // Test 1: Mass /start
  console.log('\n📋 Test 1/3: Mass /start');
  try {
    const passed = await runMassStartTest(level.users, 10);
    results.tests.push({
      name: 'mass-start',
      passed,
      users: level.users
    });
  } catch (error) {
    console.error('Test failed:', error);
    results.tests.push({
      name: 'mass-start',
      passed: false,
      error: error.message
    });
  }

  // Test 2: Mass Graph Updates
  console.log('\n📋 Test 2/3: Mass Graph Updates');
  try {
    const passed = await runMassGraphUpdatesTest(level.users, 5);
    results.tests.push({
      name: 'mass-graph-updates',
      passed,
      users: level.users
    });
  } catch (error) {
    console.error('Test failed:', error);
    results.tests.push({
      name: 'mass-graph-updates',
      passed: false,
      error: error.message
    });
  }

  // Test 3: IP Monitoring
  console.log('\n📋 Test 3/3: IP Monitoring');
  try {
    const passed = await runIPMonitoringTest(level.ips, Math.floor(level.ips * 0.2), Math.floor(level.ips * 0.8));
    results.tests.push({
      name: 'ip-monitoring',
      passed,
      users: level.ips
    });
  } catch (error) {
    console.error('Test failed:', error);
    results.tests.push({
      name: 'ip-monitoring',
      passed: false,
      error: error.message
    });
  }

  // Підсумок
  const totalTests = results.tests.length;
  const passedTests = results.tests.filter(t => t.passed).length;
  const failedTests = totalTests - passedTests;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`SUMMARY - ${level.name.toUpperCase()} LEVEL`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  results.tests.forEach(test => {
    const status = test.passed ? '✅' : '❌';
    console.log(`  ${status} ${test.name}`);
    if (test.error) {
      console.log(`      Error: ${test.error}`);
    }
  });
  console.log(`${'='.repeat(80)}\n`);

  // Зберегти результати
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const reportPath = path.join(reportDir, `summary-${level.name.toLowerCase()}-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`📄 Summary saved to: ${reportPath}\n`);

  return passedTests === totalTests;
}

/**
 * Запустити тести для всіх рівнів
 */
async function runAllLoadTests() {
  console.log('\n' + '='.repeat(80));
  console.log('LOAD TESTING SUITE - ALL LEVELS');
  console.log('='.repeat(80));

  const allResults = [];

  for (const [levelName, levelConfig] of Object.entries(LOAD_LEVELS)) {
    console.log(`\n\n🚀 Starting ${levelName} level tests...`);
    const passed = await runLoadTestsForLevel(levelConfig);
    allResults.push({ level: levelName, passed });
    
    // Затримка між рівнями
    if (levelName !== 'STRESS') {
      console.log('\n⏸️  Waiting 5 seconds before next level...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Фінальний підсумок
  console.log('\n' + '='.repeat(80));
  console.log('FINAL SUMMARY - ALL LEVELS');
  console.log('='.repeat(80));
  
  allResults.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.level} level`);
  });
  
  const allPassed = allResults.every(r => r.passed);
  console.log(`\nOverall result: ${allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
  console.log('='.repeat(80) + '\n');

  return allPassed;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const level = args[0] ? args[0].toUpperCase() : null;

  if (level && LOAD_LEVELS[level]) {
    // Запустити тести для одного рівня
    runLoadTestsForLevel(LOAD_LEVELS[level])
      .then(passed => process.exit(passed ? 0 : 1))
      .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
      });
  } else if (level === 'ALL') {
    // Запустити всі рівні
    runAllLoadTests()
      .then(passed => process.exit(passed ? 0 : 1))
      .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
      });
  } else {
    // Показати допомогу
    console.log('Usage: node run-load-tests.js [LEVEL]');
    console.log('\nAvailable levels:');
    Object.entries(LOAD_LEVELS).forEach(([name, config]) => {
      console.log(`  ${name.padEnd(8)} - ${config.users} users, ${config.channels} channels, ${config.ips} IPs`);
    });
    console.log('  ALL      - Run all levels sequentially');
    console.log('\nExamples:');
    console.log('  node run-load-tests.js SMALL');
    console.log('  node run-load-tests.js MEDIUM');
    console.log('  node run-load-tests.js ALL');
    process.exit(1);
  }
}

module.exports = {
  runLoadTestsForLevel,
  runAllLoadTests,
  LOAD_LEVELS
};
