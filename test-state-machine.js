/**
 * Test for State Machine Framework
 * 
 * This test demonstrates the formal state machine implementation
 * and validates its core functionality.
 */

const assert = require('assert');
const { StateMachine, createStateHandler } = require('./src/state/stateMachine');

console.log('🧪 Testing State Machine Framework...\n');

// Test configuration
const TEST_CONFIG = {
  SHORT_TIMEOUT: 5000, // 5 seconds for testing
  TIMEOUT_BUFFER: 500  // Extra time to wait for timeout to fire
};

// Track events for testing
const events = [];

// Define a simple wizard state machine
const wizardStates = {
  selectRegion: createStateHandler({
    onEnter: async (userId, context) => {
      events.push({ type: 'enter', state: 'selectRegion', userId });
    },
    onInput: async (userId, input, context, machine) => {
      if (input.region) {
        await machine.transition(userId, 'selectQueue', { region: input.region });
        return { handled: true };
      }
      return { handled: false };
    },
    onCancel: async (userId, context) => {
      events.push({ type: 'cancel', state: 'selectRegion', userId });
    },
    onTimeout: async (userId, context) => {
      events.push({ type: 'timeout', state: 'selectRegion', userId });
    },
    onExit: async (userId, context) => {
      events.push({ type: 'exit', state: 'selectRegion', userId });
    },
    timeout: TEST_CONFIG.SHORT_TIMEOUT
  }),
  
  selectQueue: createStateHandler({
    onEnter: async (userId, context) => {
      events.push({ type: 'enter', state: 'selectQueue', userId, region: context.region });
    },
    onInput: async (userId, input, context, machine) => {
      if (input.queue) {
        await machine.transition(userId, 'complete', { queue: input.queue });
        return { handled: true };
      }
      return { handled: false };
    },
    onCancel: async (userId, context) => {
      events.push({ type: 'cancel', state: 'selectQueue', userId });
    },
    onTimeout: async (userId, context) => {
      events.push({ type: 'timeout', state: 'selectQueue', userId });
    },
    onExit: async (userId, context) => {
      events.push({ type: 'exit', state: 'selectQueue', userId });
    }
  }),
  
  complete: createStateHandler({
    onEnter: async (userId, context) => {
      events.push({ type: 'enter', state: 'complete', userId, data: context });
    },
    onInput: async (userId, input, context, machine) => {
      return { handled: true };
    },
    onCancel: async (userId, context) => {
      events.push({ type: 'cancel', state: 'complete', userId });
    },
    onTimeout: async (userId, context) => {
      events.push({ type: 'timeout', state: 'complete', userId });
    },
    onExit: async (userId, context) => {
      events.push({ type: 'exit', state: 'complete', userId });
    }
  })
};

// Test 1: Create state machine
console.log('Test 1: Create state machine');
const wizardMachine = new StateMachine('wizard', wizardStates, {
  persistToDb: false, // Disable DB for testing
  logTransitions: true
});
assert(wizardMachine.name === 'wizard', 'Machine should have correct name');
console.log('✓ State machine created\n');

// Test 2: Start state machine
console.log('Test 2: Start state machine');
async function test2() {
  events.length = 0; // Clear events
  
  await wizardMachine.start(12345, 'selectRegion');
  
  assert(wizardMachine.isActive(12345), 'Machine should be active');
  assert(wizardMachine.getState(12345) === 'selectRegion', 'Should be in selectRegion state');
  assert(events.some(e => e.type === 'enter' && e.state === 'selectRegion'), 'onEnter should be called');
  
  console.log('✓ State machine started\n');
}

// Test 3: Handle input and transition
console.log('Test 3: Handle input and transition');
async function test3() {
  events.length = 0; // Clear events
  
  await wizardMachine.handleInput(12345, { region: 'kyiv' });
  
  assert(wizardMachine.getState(12345) === 'selectQueue', 'Should transition to selectQueue');
  assert(events.some(e => e.type === 'exit' && e.state === 'selectRegion'), 'onExit should be called for old state');
  assert(events.some(e => e.type === 'enter' && e.state === 'selectQueue'), 'onEnter should be called for new state');
  
  const instance = wizardMachine.getInstance(12345);
  assert(instance.context.region === 'kyiv', 'Context should be preserved');
  assert(instance.history.includes('selectRegion'), 'History should include old state');
  assert(instance.history.includes('selectQueue'), 'History should include new state');
  
  console.log('✓ Input handled and transition successful\n');
}

// Test 4: Complete flow
console.log('Test 4: Complete flow');
async function test4() {
  events.length = 0; // Clear events
  
  await wizardMachine.handleInput(12345, { queue: '1.1' });
  
  assert(wizardMachine.getState(12345) === 'complete', 'Should transition to complete');
  
  const instance = wizardMachine.getInstance(12345);
  assert(instance.context.region === 'kyiv', 'Context should have region');
  assert(instance.context.queue === '1.1', 'Context should have queue');
  assert(instance.history.length === 3, 'History should have all states');
  
  console.log('✓ Flow completed\n');
}

// Test 5: Cancel
console.log('Test 5: Cancel state machine');
async function test5() {
  events.length = 0; // Clear events
  
  await wizardMachine.start(67890, 'selectRegion');
  await wizardMachine.cancel(67890);
  
  assert(!wizardMachine.isActive(67890), 'Machine should not be active after cancel');
  assert(events.some(e => e.type === 'cancel' && e.state === 'selectRegion'), 'onCancel should be called');
  assert(events.some(e => e.type === 'exit' && e.state === 'selectRegion'), 'onExit should be called');
  
  console.log('✓ Cancel handled\n');
}

// Test 6: Timeout
console.log('Test 6: Timeout handling');
async function test6() {
  return new Promise(async (resolve) => {
    events.length = 0; // Clear events
    
    await wizardMachine.start(11111, 'selectRegion');
    
    // Wait for timeout (5 seconds + buffer)
    setTimeout(() => {
      assert(!wizardMachine.isActive(11111), 'Machine should not be active after timeout');
      assert(events.some(e => e.type === 'timeout' && e.state === 'selectRegion'), 'onTimeout should be called');
      assert(events.some(e => e.type === 'exit' && e.state === 'selectRegion'), 'onExit should be called');
      
      console.log('✓ Timeout handled\n');
      resolve();
    }, TEST_CONFIG.SHORT_TIMEOUT + TEST_CONFIG.TIMEOUT_BUFFER);
  });
}

// Test 7: Multiple users
console.log('Test 7: Multiple users simultaneously');
async function test7() {
  events.length = 0; // Clear events
  
  await wizardMachine.start(111, 'selectRegion');
  await wizardMachine.start(222, 'selectRegion');
  await wizardMachine.start(333, 'selectRegion');
  
  assert(wizardMachine.isActive(111), 'User 111 should be active');
  assert(wizardMachine.isActive(222), 'User 222 should be active');
  assert(wizardMachine.isActive(333), 'User 333 should be active');
  
  await wizardMachine.handleInput(111, { region: 'kyiv' });
  await wizardMachine.handleInput(222, { region: 'dnipro' });
  
  assert(wizardMachine.getState(111) === 'selectQueue', 'User 111 should be in selectQueue');
  assert(wizardMachine.getState(222) === 'selectQueue', 'User 222 should be in selectQueue');
  assert(wizardMachine.getState(333) === 'selectRegion', 'User 333 should still be in selectRegion');
  
  const instance111 = wizardMachine.getInstance(111);
  const instance222 = wizardMachine.getInstance(222);
  
  assert(instance111.context.region === 'kyiv', 'User 111 context should be independent');
  assert(instance222.context.region === 'dnipro', 'User 222 context should be independent');
  
  // Cleanup
  await wizardMachine.cancel(111);
  await wizardMachine.cancel(222);
  await wizardMachine.cancel(333);
  
  console.log('✓ Multiple users handled independently\n');
}

// Run all tests
async function runTests() {
  try {
    await test2();
    await test3();
    await test4();
    await test5();
    await test6();
    await test7();
    
    console.log('═══════════════════════════════════════');
    console.log('✅ ВСІ ТЕСТИ ПРОЙДЕНО УСПІШНО!');
    console.log('═══════════════════════════════════════\n');
    console.log('✨ State Machine готова до використання!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Тест провалився:', error);
    process.exit(1);
  }
}

runTests();
