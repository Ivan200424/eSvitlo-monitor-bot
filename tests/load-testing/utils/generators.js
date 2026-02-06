/**
 * Data Generators for Load Testing
 * Генерує тестові дані для симуляції навантаження
 */

const { REGION_CODES, QUEUES } = require('../../../src/constants/regions');

/**
 * Генерувати випадковий ID користувача
 */
function generateUserId(index) {
  return 1000000 + index;
}

/**
 * Генерувати випадковий ID каналу
 */
function generateChannelId(index) {
  return -1001000000000 - index;
}

/**
 * Генерувати випадкову IP адресу
 */
function generateIP(index) {
  const a = Math.floor(index / 65536) % 256;
  const b = Math.floor(index / 256) % 256;
  const c = index % 256;
  return `192.168.${b}.${c}`;
}

/**
 * Генерувати випадковий регіон
 */
function generateRegion() {
  return REGION_CODES[Math.floor(Math.random() * REGION_CODES.length)];
}

/**
 * Генерувати випадкову чергу
 */
function generateQueue() {
  return QUEUES[Math.floor(Math.random() * QUEUES.length)];
}

/**
 * Генерувати користувача
 */
function generateUser(index) {
  return {
    telegram_id: generateUserId(index),
    region: generateRegion(),
    queue: generateQueue(),
    router_address: null,
    channel_id: null,
    notification_enabled: true,
    monitor_enabled: false
  };
}

/**
 * Генерувати канал
 */
function generateChannel(index) {
  return {
    channel_id: generateChannelId(index),
    title: `Test Channel ${index}`,
    username: `testchannel${index}`
  };
}

/**
 * Генерувати масив користувачів
 */
function generateUsers(count) {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push(generateUser(i));
  }
  return users;
}

/**
 * Генерувати масив каналів
 */
function generateChannels(count) {
  const channels = [];
  for (let i = 0; i < count; i++) {
    channels.push(generateChannel(i));
  }
  return channels;
}

/**
 * Генерувати масив IP адрес
 */
function generateIPs(count) {
  const ips = [];
  for (let i = 0; i < count; i++) {
    ips.push(generateIP(i));
  }
  return ips;
}

/**
 * Генерувати тестові дані графіка
 */
function generateScheduleData(region) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayTimestamp = Math.floor(today.getTime() / 1000);
  const tomorrowTimestamp = todayTimestamp + 86400;
  
  // Генеруємо випадковий графік
  const scheduleData = {};
  for (let queue of QUEUES) {
    scheduleData[queue] = {};
    
    // Сьогодні
    for (let hour = 0; hour < 24; hour += 3) {
      const state = Math.random() > 0.5 ? 'yes' : 'no';
      scheduleData[queue][hour] = state;
    }
  }
  
  return {
    fact: {
      today: todayTimestamp,
      data: {
        [todayTimestamp]: scheduleData,
        [tomorrowTimestamp]: scheduleData
      }
    }
  };
}

/**
 * Load levels
 */
const LOAD_LEVELS = {
  SMALL: {
    name: 'Small',
    users: 50,
    channels: 10,
    ips: 10
  },
  MEDIUM: {
    name: 'Medium',
    users: 300,
    channels: 50,
    ips: 50
  },
  HIGH: {
    name: 'High',
    users: 1000,
    channels: 200,
    ips: 200
  },
  STRESS: {
    name: 'Stress',
    users: 5000,
    channels: 1000,
    ips: 1000
  }
};

/**
 * Згенерувати дані для певного рівня навантаження
 */
function generateLoadData(level) {
  const config = LOAD_LEVELS[level];
  if (!config) {
    throw new Error(`Unknown load level: ${level}`);
  }
  
  return {
    level: config.name,
    users: generateUsers(config.users),
    channels: generateChannels(config.channels),
    ips: generateIPs(config.ips)
  };
}

/**
 * Затримка
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Виконати дії паралельно з обмеженням
 */
async function parallelWithLimit(items, limit, asyncFn) {
  const results = [];
  const executing = [];
  
  for (const item of items) {
    const promise = asyncFn(item).then(result => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });
    
    results.push(promise);
    executing.push(promise);
    
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
}

module.exports = {
  generateUserId,
  generateChannelId,
  generateIP,
  generateRegion,
  generateQueue,
  generateUser,
  generateChannel,
  generateUsers,
  generateChannels,
  generateIPs,
  generateScheduleData,
  generateLoadData,
  LOAD_LEVELS,
  delay,
  parallelWithLimit
};
