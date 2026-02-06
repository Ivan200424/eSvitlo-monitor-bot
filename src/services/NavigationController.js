/**
 * Navigation Controller
 * 
 * Централізоване управління навігацією та клавіатурами згідно з технічною специфікацією.
 * 
 * Принципи (розділ 5 специфікації):
 * 
 * 5.1 Reply keyboard:
 * - Тільки глобальна навігація
 * - Статична
 * - Ніколи не змінює стан напряму
 * 
 * 5.2 Inline keyboard:
 * - Тільки контекстні дії
 * - Прив'язані до конкретного повідомлення та стану
 * 
 * 5.3 Обов'язкові inline кнопки для будь-якого потоку:
 * - ← Назад
 * - ⤴ Меню
 * 
 * 5.4 Reply кнопки НЕ МОЖУТЬ:
 * - Підтверджувати дії
 * - Скасовувати дії
 * - Змінювати стан
 */

const keyboards = require('../keyboards/inline');

/**
 * Navigation Controller Class
 * Manages all navigation flows and keyboard generation
 */
class NavigationController {
  constructor() {
    // Navigation graph - defines valid transitions
    this.navigationGraph = {
      main: {
        validTargets: ['schedule', 'timer', 'stats', 'settings', 'help'],
        keyboard: 'getMainMenuInline'
      },
      schedule: {
        validTargets: ['main', 'timer'],
        keyboard: null,
        backTo: 'main'
      },
      timer: {
        validTargets: ['main', 'schedule'],
        keyboard: null,
        backTo: 'main'
      },
      stats: {
        validTargets: ['main'],
        keyboard: null,
        backTo: 'main'
      },
      settings: {
        validTargets: ['main', 'settings_ip', 'settings_channel', 'settings_alerts', 'settings_notifications'],
        keyboard: 'getSettingsKeyboard',
        backTo: 'main'
      },
      settings_ip: {
        validTargets: ['settings'],
        keyboard: null,
        backTo: 'settings'
      },
      settings_channel: {
        validTargets: ['settings'],
        keyboard: null,
        backTo: 'settings'
      },
      settings_alerts: {
        validTargets: ['settings'],
        keyboard: 'getAlertsSettingsKeyboard',
        backTo: 'settings'
      },
      settings_notifications: {
        validTargets: ['settings'],
        keyboard: null,
        backTo: 'settings'
      },
      help: {
        validTargets: ['main'],
        keyboard: null,
        backTo: 'main'
      }
    };
  }
  
  /**
   * Get global reply keyboard (section 5.1)
   * This keyboard is shown to all active users
   * It provides global navigation only - does NOT change state
   */
  getGlobalKeyboard() {
    return keyboards.getMainMenu();
  }
  
  /**
   * Get contextual inline keyboard for a specific screen
   * Always includes navigation buttons (← Back, ⤴ Menu)
   */
  getContextualKeyboard(screen, options = {}) {
    const screenConfig = this.navigationGraph[screen];
    
    if (!screenConfig) {
      throw new Error(`Unknown screen: ${screen}`);
    }
    
    let keyboard;
    
    // Get screen-specific keyboard if defined
    if (screenConfig.keyboard && typeof keyboards[screenConfig.keyboard] === 'function') {
      keyboard = keyboards[screenConfig.keyboard](options);
    } else {
      // Create basic keyboard with just navigation
      keyboard = this._createBasicKeyboard(screen, options);
    }
    
    // Ensure navigation buttons are present
    return this._ensureNavigationButtons(keyboard, screen, options);
  }
  
  /**
   * Create a basic inline keyboard with just navigation buttons
   */
  _createBasicKeyboard(screen, options = {}) {
    const buttons = [];
    
    // Add content buttons if provided
    if (options.contentButtons) {
      buttons.push(...options.contentButtons);
    }
    
    return {
      reply_markup: {
        inline_keyboard: buttons
      }
    };
  }
  
  /**
   * Ensure navigation buttons (← Back, ⤴ Menu) are present
   * According to section 5.3 - mandatory for ALL flows
   */
  _ensureNavigationButtons(keyboard, screen, options = {}) {
    if (!keyboard || !keyboard.reply_markup || !keyboard.reply_markup.inline_keyboard) {
      return keyboard;
    }
    
    const buttons = keyboard.reply_markup.inline_keyboard;
    const screenConfig = this.navigationGraph[screen];
    
    // Check if navigation buttons already exist
    const hasBackButton = buttons.some(row => 
      row.some(btn => btn.callback_data && btn.callback_data.includes('back'))
    );
    const hasMenuButton = buttons.some(row => 
      row.some(btn => btn.callback_data === 'back_to_main' || btn.callback_data === 'menu_main')
    );
    
    // Add navigation row if not present
    if (!hasBackButton || !hasMenuButton) {
      const navRow = [];
      
      // Add Back button if we have a backTo target and no back button exists
      if (screenConfig.backTo && !hasBackButton && !options.hideBackButton) {
        navRow.push({
          text: '← Назад',
          callback_data: `back_to_${screenConfig.backTo}`
        });
      }
      
      // Add Menu button if not exists
      if (!hasMenuButton && !options.hideMenuButton) {
        navRow.push({
          text: '⤴ Меню',
          callback_data: 'back_to_main'
        });
      }
      
      if (navRow.length > 0) {
        buttons.push(navRow);
      }
    }
    
    return keyboard;
  }
  
  /**
   * Validate navigation transition
   * Ensures users can only navigate to valid targets
   */
  canNavigate(fromScreen, toScreen) {
    const screenConfig = this.navigationGraph[fromScreen];
    
    if (!screenConfig) {
      return false;
    }
    
    return screenConfig.validTargets.includes(toScreen);
  }
  
  /**
   * Get back target for a screen
   */
  getBackTarget(screen) {
    const screenConfig = this.navigationGraph[screen];
    return screenConfig ? screenConfig.backTo : 'main';
  }
  
  /**
   * Create wizard keyboard with step indicator
   * Used for multi-step flows (onboarding, IP setup, channel setup)
   */
  createWizardKeyboard(step, totalSteps, buttons, options = {}) {
    const keyboard = {
      reply_markup: {
        inline_keyboard: [...buttons]
      }
    };
    
    // Add navigation row
    const navRow = [];
    
    // Add Cancel button for wizards
    if (!options.hideCancel) {
      navRow.push({
        text: '❌ Скасувати',
        callback_data: 'wizard_cancel'
      });
    }
    
    // Add Back button if not first step
    if (step > 1 && !options.hideBack) {
      navRow.push({
        text: '← Назад',
        callback_data: 'wizard_back'
      });
    }
    
    if (navRow.length > 0) {
      keyboard.reply_markup.inline_keyboard.push(navRow);
    }
    
    return keyboard;
  }
  
  /**
   * Create confirmation keyboard
   * Used for critical actions that need user confirmation
   */
  createConfirmationKeyboard(confirmData, cancelData, options = {}) {
    const buttons = [
      [
        { 
          text: options.confirmText || '✅ Підтвердити', 
          callback_data: confirmData 
        },
        { 
          text: options.cancelText || '❌ Скасувати', 
          callback_data: cancelData 
        }
      ]
    ];
    
    // Add menu button
    if (!options.hideMenu) {
      buttons.push([
        { text: '⤴ Меню', callback_data: 'back_to_main' }
      ]);
    }
    
    return {
      reply_markup: {
        inline_keyboard: buttons
      }
    };
  }
  
  /**
   * Create error keyboard
   * According to section 16.3 - every error message MUST include navigation buttons
   */
  createErrorKeyboard(retryData = null) {
    const buttons = [];
    
    // Add retry button if provided
    if (retryData) {
      buttons.push([
        { text: '🔄 Спробувати ще раз', callback_data: retryData }
      ]);
    }
    
    // Always add menu button for errors
    buttons.push([
      { text: '⤴ Меню', callback_data: 'back_to_main' }
    ]);
    
    return {
      reply_markup: {
        inline_keyboard: buttons
      }
    };
  }
  
  /**
   * Log navigation action
   * According to section 17.1 - state transitions must be logged
   */
  logNavigation(userId, from, to, method = 'button') {
    console.log(`🧭 [Navigation] User ${userId}: ${from} → ${to} (via ${method})`);
  }
}

// Singleton instance
const navigationController = new NavigationController();

module.exports = navigationController;
