// IP/Power monitoring service
import { exec } from 'child_process';
import { promisify } from 'util';
import { env } from '../config/env.js';

const execAsync = promisify(exec);

const userStates = new Map();
let monitoringInterval = null;

export function startMonitoring(bot, onStateChange) {
  if (monitoringInterval) {
    return;
  }
  
  const intervalMs = env.POWER_CHECK_INTERVAL * 1000;
  
  monitoringInterval = setInterval(async () => {
    await checkAllUsers(bot, onStateChange);
  }, intervalMs);
  
  console.log(`✅ IP моніторинг запущено (інтервал: ${env.POWER_CHECK_INTERVAL}с)`);
}

export function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('✅ IP моніторинг зупинено');
  }
}

async function checkAllUsers(bot, onStateChange) {
  // This would iterate through users with IP monitoring enabled
  // and check their router status
  // Simplified version - actual implementation would query DB
  
  for (const [userId, state] of userStates.entries()) {
    if (state.routerIp) {
      const isOnline = await pingHost(state.routerIp);
      await handleStateChange(bot, userId, isOnline, onStateChange);
    }
  }
}

async function pingHost(host, port = 80, timeout = 5000) {
  try {
    const command = process.platform === 'win32' 
      ? `ping -n 1 -w ${timeout} ${host}`
      : `ping -c 1 -W ${Math.ceil(timeout / 1000)} ${host}`;
    
    await execAsync(command);
    return true;
  } catch (error) {
    return false;
  }
}

async function handleStateChange(bot, userId, isOnline, callback) {
  const state = userStates.get(userId) || {};
  const previousState = state.powerState;
  const debounceMs = env.POWER_DEBOUNCE_MINUTES * 60 * 1000;
  
  if (previousState === undefined) {
    state.powerState = isOnline;
    state.lastChange = Date.now();
    userStates.set(userId, state);
    return;
  }
  
  if (isOnline !== previousState) {
    const timeSinceChange = Date.now() - (state.lastChange || 0);
    
    if (timeSinceChange >= debounceMs) {
      state.powerState = isOnline;
      state.lastChange = Date.now();
      userStates.set(userId, state);
      
      if (callback) {
        await callback(userId, isOnline);
      }
    }
  }
}

export function setUserRouter(userId, routerIp) {
  const state = userStates.get(userId) || {};
  state.routerIp = routerIp;
  userStates.set(userId, state);
}

export function removeUserRouter(userId) {
  userStates.delete(userId);
}

export function getUserPowerState(userId) {
  return userStates.get(userId);
}
