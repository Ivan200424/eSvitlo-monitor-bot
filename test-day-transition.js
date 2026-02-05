#!/usr/bin/env node

/**
 * Тест переходу календарного дня
 * Перевіряє що графік "на завтра" стає графіком "на сьогодні" після переходу дня
 */

console.log('🧪 Тестування переходу календарного дня\n');

// Підключаємо необхідні модулі
const path = require('path');
const fs = require('fs');

// Видаляємо тестову БД якщо існує
const testDbPath = './data/test_day_transition.db';
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

// Встановлюємо тестову БД
process.env.DATABASE_PATH = testDbPath;

// Підключаємо модулі після встановлення DATABASE_PATH
const db = require('./src/database/db');
const usersDb = require('./src/database/users');
const { calculateScheduleHash } = require('./src/utils');

console.log('📝 Тест: Перехід календарного дня');
console.log('');

// Створюємо тестового користувача
const userId = usersDb.createUser('test_user_123', 'TestUser', 'kyiv', '1.1');
console.log(`✅ Створено користувача з ID: ${userId}`);

// Симулюємо графік "сьогодні" та "завтра"
const todayEvents = [
  { start: '2026-02-05T10:00:00Z', end: '2026-02-05T12:00:00Z' }
];

const tomorrowEvents = [
  { start: '2026-02-06T14:00:00Z', end: '2026-02-06T16:00:00Z' }
];

const hashToday = calculateScheduleHash(todayEvents);
const hashTomorrow = calculateScheduleHash(tomorrowEvents);

console.log(`Hash сьогодні: ${hashToday}`);
console.log(`Hash завтра: ${hashTomorrow}`);

// Зберігаємо стан графіків
usersDb.updateScheduleState(userId, hashToday, hashTomorrow, '2026-02-05', '2026-02-06');
console.log('✅ Збережено стан графіків (сьогодні: 2026-02-05, завтра: 2026-02-06)');
console.log('');

// Перевіряємо збережений стан
let user = usersDb.getUserById(userId);
console.log('Стан до переходу дня:');
console.log(`  schedule_hash_today: ${user.schedule_hash_today}`);
console.log(`  schedule_hash_tomorrow: ${user.schedule_hash_tomorrow}`);
console.log(`  last_published_date_today: ${user.last_published_date_today}`);
console.log(`  last_published_date_tomorrow: ${user.last_published_date_tomorrow}`);
console.log('');

// Виконуємо перехід дня
console.log('🔄 Виконуємо перехід календарного дня...');
usersDb.transitionScheduleDay(userId);

// Перевіряємо стан після переходу
user = usersDb.getUserById(userId);
console.log('');
console.log('Стан після переходу дня:');
console.log(`  schedule_hash_today: ${user.schedule_hash_today}`);
console.log(`  schedule_hash_tomorrow: ${user.schedule_hash_tomorrow}`);
console.log(`  last_published_date_today: ${user.last_published_date_today}`);
console.log(`  last_published_date_tomorrow: ${user.last_published_date_tomorrow}`);
console.log('');

// Перевірки
let testsPassed = 0;
let testsFailed = 0;

// Перевірка 1: schedule_hash_tomorrow став schedule_hash_today
if (user.schedule_hash_today === hashTomorrow) {
  console.log('✅ Перевірка 1: schedule_hash_tomorrow став schedule_hash_today');
  testsPassed++;
} else {
  console.log('❌ ПОМИЛКА: schedule_hash_tomorrow повинен стати schedule_hash_today');
  console.log(`  Очікувалось: ${hashTomorrow}`);
  console.log(`  Отримано: ${user.schedule_hash_today}`);
  testsFailed++;
}

// Перевірка 2: last_published_date_tomorrow став last_published_date_today
if (user.last_published_date_today === '2026-02-06') {
  console.log('✅ Перевірка 2: last_published_date_tomorrow став last_published_date_today');
  testsPassed++;
} else {
  console.log('❌ ПОМИЛКА: last_published_date_tomorrow повинен стати last_published_date_today');
  console.log(`  Очікувалось: 2026-02-06`);
  console.log(`  Отримано: ${user.last_published_date_today}`);
  testsFailed++;
}

// Перевірка 3: schedule_hash_tomorrow скинувся в null
if (user.schedule_hash_tomorrow === null) {
  console.log('✅ Перевірка 3: schedule_hash_tomorrow скинувся в null');
  testsPassed++;
} else {
  console.log('❌ ПОМИЛКА: schedule_hash_tomorrow повинен бути null');
  console.log(`  Отримано: ${user.schedule_hash_tomorrow}`);
  testsFailed++;
}

// Перевірка 4: last_published_date_tomorrow скинувся в null
if (user.last_published_date_tomorrow === null) {
  console.log('✅ Перевірка 4: last_published_date_tomorrow скинувся в null');
  testsPassed++;
} else {
  console.log('❌ ПОМИЛКА: last_published_date_tomorrow повинен бути null');
  console.log(`  Отримано: ${user.last_published_date_tomorrow}`);
  testsFailed++;
}

console.log('');
console.log(`Результат: ${testsPassed} пройдено, ${testsFailed} провалено`);

// Закриваємо БД та видаляємо тестовий файл
db.closeDatabase();
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

// Видаляємо директорію data якщо порожня
try {
  fs.rmdirSync('./data');
} catch (e) {
  // Ігноруємо помилку якщо директорія не порожня
}

if (testsFailed > 0) {
  process.exit(1);
}

console.log('');
console.log('✅ Всі тести переходу дня пройдено успішно!');
