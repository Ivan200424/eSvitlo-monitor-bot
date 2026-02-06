/**
 * Navigation Graph Configuration
 * 
 * Defines the navigation structure and valid transitions for the bot.
 * Externalized from NavigationController for easier maintenance and testing.
 */

const NAVIGATION_GRAPH = {
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

module.exports = { NAVIGATION_GRAPH };
