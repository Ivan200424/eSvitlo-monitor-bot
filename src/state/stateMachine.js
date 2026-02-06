/**
 * Formal State Machine Framework
 * 
 * Implements a production-ready state machine according to the technical specification.
 * 
 * Key principles (from spec section 4):
 * - ALL user interactions as finite state machine
 * - NO implicit states allowed
 * - Every state MUST define: onEnter, onInput, onCancel, onTimeout, onExit
 * - Every state MUST have timeout
 * - Timeout MUST clean state
 * - Cancel MUST always return control
 * - State transitions MUST be logged
 * - User MUST never be stuck in a state
 */

const { saveUserState, deleteUserState } = require('../database/db');

// Default timeout for all states (10 minutes in milliseconds)
// Note: This is a conservative default. Most user interactions should complete
// within a few minutes. For longer flows, specify a custom timeout in state config.
const DEFAULT_TIMEOUT = 10 * 60 * 1000;

/**
 * State Machine Class
 * Manages state transitions and lifecycle for a specific user flow
 */
class StateMachine {
  constructor(name, states, options = {}) {
    this.name = name;
    this.states = states;
    this.options = {
      defaultTimeout: options.defaultTimeout || DEFAULT_TIMEOUT,
      logTransitions: options.logTransitions !== false, // Default true
      persistToDb: options.persistToDb !== false, // Default true
      ...options
    };
    
    // Active instances: Map<userId, StateInstance>
    this.instances = new Map();
    
    // Validate state definitions
    this._validateStates();
  }
  
  /**
   * Validate that all states have required properties
   */
  _validateStates() {
    const requiredProperties = ['onEnter', 'onInput', 'onCancel', 'onTimeout', 'onExit'];
    
    for (const [stateName, stateConfig] of Object.entries(this.states)) {
      for (const prop of requiredProperties) {
        if (typeof stateConfig[prop] !== 'function') {
          throw new Error(
            `State "${stateName}" in machine "${this.name}" missing required handler "${prop}"`
          );
        }
      }
      
      // Ensure timeout is defined
      if (!stateConfig.timeout && !this.options.defaultTimeout) {
        throw new Error(
          `State "${stateName}" in machine "${this.name}" has no timeout defined`
        );
      }
    }
  }
  
  /**
   * Start a new state machine instance for a user
   */
  async start(userId, initialStateName, context = {}) {
    if (!this.states[initialStateName]) {
      throw new Error(`Unknown state: ${initialStateName}`);
    }
    
    // Check if instance already exists
    if (this.instances.has(userId)) {
      console.warn(`⚠️ State machine "${this.name}" already active for user ${userId}`);
      await this.cancel(userId); // Clean up existing instance
    }
    
    const instance = {
      userId,
      currentState: initialStateName,
      context,
      startedAt: Date.now(),
      lastTransitionAt: Date.now(),
      history: [initialStateName],
      timeoutHandle: null
    };
    
    this.instances.set(userId, instance);
    
    // Log transition
    if (this.options.logTransitions) {
      console.log(`🔄 [${this.name}] User ${userId}: START → ${initialStateName}`);
    }
    
    // Persist to DB if enabled
    if (this.options.persistToDb) {
      await this._persistState(instance);
    }
    
    // Set up timeout
    this._setupTimeout(instance);
    
    // Call onEnter handler
    try {
      const state = this.states[initialStateName];
      await state.onEnter(userId, context, this);
    } catch (error) {
      console.error(`❌ [${this.name}] Error in onEnter for state ${initialStateName}:`, error);
      // Don't throw - state machine should be resilient
    }
    
    return instance;
  }
  
  /**
   * Transition to a new state
   */
  async transition(userId, newStateName, additionalContext = {}) {
    const instance = this.instances.get(userId);
    
    if (!instance) {
      throw new Error(`No active state machine instance for user ${userId}`);
    }
    
    if (!this.states[newStateName]) {
      throw new Error(`Unknown state: ${newStateName}`);
    }
    
    const oldState = instance.currentState;
    const oldStateConfig = this.states[oldState];
    const newStateConfig = this.states[newStateName];
    
    // Call onExit handler for old state
    try {
      await oldStateConfig.onExit(userId, instance.context, this);
    } catch (error) {
      console.error(`❌ [${this.name}] Error in onExit for state ${oldState}:`, error);
    }
    
    // Clear existing timeout
    if (instance.timeoutHandle) {
      clearTimeout(instance.timeoutHandle);
    }
    
    // Update instance
    instance.currentState = newStateName;
    instance.context = { ...instance.context, ...additionalContext };
    instance.lastTransitionAt = Date.now();
    instance.history.push(newStateName);
    
    // Log transition
    if (this.options.logTransitions) {
      console.log(`🔄 [${this.name}] User ${userId}: ${oldState} → ${newStateName}`);
    }
    
    // Persist to DB if enabled
    if (this.options.persistToDb) {
      await this._persistState(instance);
    }
    
    // Set up new timeout
    this._setupTimeout(instance);
    
    // Call onEnter handler for new state
    try {
      await newStateConfig.onEnter(userId, instance.context, this);
    } catch (error) {
      console.error(`❌ [${this.name}] Error in onEnter for state ${newStateName}:`, error);
    }
    
    return instance;
  }
  
  /**
   * Handle user input in current state
   */
  async handleInput(userId, input) {
    const instance = this.instances.get(userId);
    
    if (!instance) {
      return null; // No active state machine
    }
    
    const currentStateConfig = this.states[instance.currentState];
    
    try {
      return await currentStateConfig.onInput(userId, input, instance.context, this);
    } catch (error) {
      console.error(`❌ [${this.name}] Error in onInput for state ${instance.currentState}:`, error);
      return null;
    }
  }
  
  /**
   * Cancel the state machine (user requested cancellation)
   */
  async cancel(userId) {
    const instance = this.instances.get(userId);
    
    if (!instance) {
      return; // Already cleaned up
    }
    
    const currentStateConfig = this.states[instance.currentState];
    
    // Log cancellation
    if (this.options.logTransitions) {
      console.log(`❌ [${this.name}] User ${userId}: CANCELLED from ${instance.currentState}`);
    }
    
    // Call onCancel handler
    try {
      await currentStateConfig.onCancel(userId, instance.context, this);
    } catch (error) {
      console.error(`❌ [${this.name}] Error in onCancel for state ${instance.currentState}:`, error);
    }
    
    // Clean up
    await this._cleanup(userId);
  }
  
  /**
   * Handle state timeout
   */
  async _handleTimeout(userId) {
    const instance = this.instances.get(userId);
    
    if (!instance) {
      return; // Already cleaned up
    }
    
    const currentStateConfig = this.states[instance.currentState];
    
    // Log timeout
    if (this.options.logTransitions) {
      console.log(`⏱️ [${this.name}] User ${userId}: TIMEOUT in ${instance.currentState}`);
    }
    
    // Call onTimeout handler
    try {
      await currentStateConfig.onTimeout(userId, instance.context, this);
    } catch (error) {
      console.error(`❌ [${this.name}] Error in onTimeout for state ${instance.currentState}:`, error);
    }
    
    // Clean up
    await this._cleanup(userId);
  }
  
  /**
   * Set up timeout for current state
   */
  _setupTimeout(instance) {
    const stateConfig = this.states[instance.currentState];
    const timeout = stateConfig.timeout || this.options.defaultTimeout;
    
    if (timeout) {
      instance.timeoutHandle = setTimeout(() => {
        this._handleTimeout(instance.userId);
      }, timeout);
    }
  }
  
  /**
   * Clean up state machine instance
   */
  async _cleanup(userId) {
    const instance = this.instances.get(userId);
    
    if (!instance) {
      return;
    }
    
    // Clear timeout
    if (instance.timeoutHandle) {
      clearTimeout(instance.timeoutHandle);
    }
    
    // Call onExit handler
    try {
      const currentStateConfig = this.states[instance.currentState];
      await currentStateConfig.onExit(userId, instance.context, this);
    } catch (error) {
      console.error(`❌ [${this.name}] Error in onExit during cleanup:`, error);
    }
    
    // Remove from memory
    this.instances.delete(userId);
    
    // Remove from DB if enabled
    if (this.options.persistToDb) {
      await deleteUserState(userId, `sm_${this.name}`);
    }
  }
  
  /**
   * Persist state to database
   */
  async _persistState(instance) {
    const stateData = {
      machineName: this.name,
      currentState: instance.currentState,
      context: instance.context,
      startedAt: instance.startedAt,
      lastTransitionAt: instance.lastTransitionAt,
      history: instance.history
    };
    
    try {
      await saveUserState(instance.userId, `sm_${this.name}`, JSON.stringify(stateData));
    } catch (error) {
      console.error(`❌ [${this.name}] Failed to persist state:`, error);
    }
  }
  
  /**
   * Get current state for a user
   */
  getState(userId) {
    const instance = this.instances.get(userId);
    return instance ? instance.currentState : null;
  }
  
  /**
   * Get full instance data for a user
   */
  getInstance(userId) {
    return this.instances.get(userId);
  }
  
  /**
   * Check if user is in this state machine
   */
  isActive(userId) {
    return this.instances.has(userId);
  }
  
  /**
   * Get all active user IDs
   */
  getActiveUsers() {
    return Array.from(this.instances.keys());
  }
}

/**
 * Helper function to create a simple state handler
 */
function createStateHandler(handlers = {}) {
  return {
    onEnter: handlers.onEnter || (async () => {}),
    onInput: handlers.onInput || (async () => null),
    onCancel: handlers.onCancel || (async () => {}),
    onTimeout: handlers.onTimeout || (async () => {}),
    onExit: handlers.onExit || (async () => {}),
    timeout: handlers.timeout
  };
}

module.exports = {
  StateMachine,
  createStateHandler,
  DEFAULT_TIMEOUT
};
