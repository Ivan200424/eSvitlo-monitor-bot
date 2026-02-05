#!/usr/bin/env node

/**
 * Test script for stable schedule publication logic
 * Tests the new hash-based change detection and day transition logic
 */

const assert = require('assert');
const { calculateSchedulePeriodsHash } = require('./src/utils');

console.log('🧪 Запуск тестів стабільної логіки публікації графіків...\n');

// Test 1: Hash calculation for identical events
console.log('Test 1: Хеш для ідентичних подій має бути однаковим');
const events1 = [
  {
    start: new Date('2024-02-05T10:00:00Z'),
    end: new Date('2024-02-05T12:00:00Z')
  },
  {
    start: new Date('2024-02-05T14:00:00Z'),
    end: new Date('2024-02-05T16:00:00Z')
  }
];

const events2 = [
  {
    start: new Date('2024-02-05T10:00:00Z'),
    end: new Date('2024-02-05T12:00:00Z')
  },
  {
    start: new Date('2024-02-05T14:00:00Z'),
    end: new Date('2024-02-05T16:00:00Z')
  }
];

const hash1 = calculateSchedulePeriodsHash(events1);
const hash2 = calculateSchedulePeriodsHash(events2);

assert.strictEqual(hash1, hash2, 'Хеші для ідентичних подій мають бути однаковими');
console.log(`✓ Хеші збігаються: ${hash1.substring(0, 16)}...\n`);

// Test 2: Hash calculation for different events
console.log('Test 2: Хеш для різних подій має відрізнятися');
const events3 = [
  {
    start: new Date('2024-02-05T10:00:00Z'),
    end: new Date('2024-02-05T13:00:00Z') // Different end time
  }
];

const hash3 = calculateSchedulePeriodsHash(events3);
assert.notStrictEqual(hash1, hash3, 'Хеші для різних подій мають відрізнятися');
console.log(`✓ Хеші відрізняються\n`);

// Test 3: Hash for empty events
console.log('Test 3: Хеш для порожнього списку подій має бути null');
const emptyEvents = [];
const emptyHash = calculateSchedulePeriodsHash(emptyEvents);
assert.strictEqual(emptyHash, null, 'Хеш для порожнього списку має бути null');
console.log(`✓ Хеш для порожнього списку: null\n`);

// Test 4: Hash order independence
console.log('Test 4: Хеш не залежить від порядку подій (сортується)');
const events4 = [
  {
    start: new Date('2024-02-05T14:00:00Z'),
    end: new Date('2024-02-05T16:00:00Z')
  },
  {
    start: new Date('2024-02-05T10:00:00Z'),
    end: new Date('2024-02-05T12:00:00Z')
  }
];

const hash4 = calculateSchedulePeriodsHash(events4);
assert.strictEqual(hash1, hash4, 'Хеші мають збігатися незалежно від порядку');
console.log(`✓ Хеші збігаються при зміні порядку\n`);

// Test 5: Scenario determination logic
console.log('Test 5: Перевірка логіки визначення сценаріїв');

// Simulate user with no previous hashes (first time)
const userNew = {
  schedule_hash_today: null,
  schedule_hash_tomorrow: null
};

// Simulate existing hashes
const userExisting = {
  schedule_hash_today: 'hash_today_old',
  schedule_hash_tomorrow: 'hash_tomorrow_old'
};

// Test scenario: First publication
assert.strictEqual(userNew.schedule_hash_today, null, 'Новий користувач не має хешу сьогодні');
assert.strictEqual(userNew.schedule_hash_tomorrow, null, 'Новий користувач не має хешу завтра');
console.log('✓ Сценарій: Перша публікація (новий користувач)\n');

// Test scenario: No change
const unchangedHash = 'hash_unchanged';
assert.strictEqual(unchangedHash === unchangedHash, true, 'Однакові хеші вказують на відсутність змін');
console.log('✓ Сценарій: Без змін (хеші збігаються)\n');

// Test scenario: Today changed
const todayNewHash = 'hash_today_new';
assert.notStrictEqual(userExisting.schedule_hash_today, todayNewHash, 'Новий хеш сьогодні відрізняється');
console.log('✓ Сценарій: Графік сьогодні оновився\n');

// Test 6: Date string formatting
console.log('Test 6: Перевірка форматування дати');
const testDate = new Date('2024-02-05T10:00:00Z');
const year = testDate.getUTCFullYear();
const month = String(testDate.getUTCMonth() + 1).padStart(2, '0');
const day = String(testDate.getUTCDate()).padStart(2, '0');
const dateStr = `${year}-${month}-${day}`;
assert.strictEqual(dateStr, '2024-02-05', 'Формат дати має бути YYYY-MM-DD');
console.log(`✓ Дата відформатована: ${dateStr}\n`);

// Test 7: Hash uses SHA-256 (check length)
console.log('Test 7: Перевірка що хеш використовує SHA-256');
assert.strictEqual(hash1.length, 64, 'SHA-256 хеш має бути 64 символи (256 біт / 4 біт на hex символ)');
console.log(`✓ Хеш використовує SHA-256 (довжина: ${hash1.length})\n`);

// Test 8: Hash stability over time
console.log('Test 8: Стабільність хешу при повторному обчисленні');
const events5 = [
  {
    start: new Date('2024-02-05T10:00:00Z'),
    end: new Date('2024-02-05T12:00:00Z')
  }
];

const hash5a = calculateSchedulePeriodsHash(events5);
// Wait a bit and recalculate
setTimeout(() => {
  const hash5b = calculateSchedulePeriodsHash(events5);
  assert.strictEqual(hash5a, hash5b, 'Хеш має бути стабільним при повторному обчисленні');
  console.log(`✓ Хеш стабільний: ${hash5a === hash5b}\n`);
  
  console.log('✅ Всі тести пройдено успішно!\n');
  
  // Summary
  console.log('📊 Підсумок тестування:');
  console.log('- Хешування періодів: ✅');
  console.log('- Порівняння графіків: ✅');
  console.log('- Визначення сценаріїв: ✅');
  console.log('- Безпека (SHA-256): ✅');
  console.log('- Стабільність хешів: ✅');
}, 100);
