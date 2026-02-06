/**
 * Test for Navigation Controller
 * 
 * Validates navigation and keyboard management according to the technical specification.
 */

const assert = require('assert');
const navigationController = require('./src/services/NavigationController');

console.log('🧪 Testing Navigation Controller...\n');

// Test 1: Global keyboard
console.log('Test 1: Global reply keyboard');
const globalKeyboard = navigationController.getGlobalKeyboard();
assert(globalKeyboard.reply_markup, 'Global keyboard should have reply_markup');
assert(globalKeyboard.reply_markup.keyboard, 'Global keyboard should have keyboard property (reply keyboard)');
assert(Array.isArray(globalKeyboard.reply_markup.keyboard), 'Keyboard should be an array');
assert(globalKeyboard.reply_markup.keyboard.length > 0, 'Keyboard should have buttons');
console.log('✓ Global keyboard is reply keyboard (not inline)\n');

// Test 2: Contextual keyboard for settings
console.log('Test 2: Contextual inline keyboard with navigation');
const settingsKeyboard = navigationController.getContextualKeyboard('settings');
assert(settingsKeyboard.reply_markup, 'Settings keyboard should have reply_markup');
assert(settingsKeyboard.reply_markup.inline_keyboard, 'Settings keyboard should be inline keyboard');

// Check for navigation buttons
const buttons = settingsKeyboard.reply_markup.inline_keyboard;
const hasMenuButton = buttons.some(row => 
  row.some(btn => btn.callback_data === 'back_to_main')
);
assert(hasMenuButton, 'Should have Menu button (⤴ Меню)');
console.log('✓ Contextual keyboard has navigation buttons\n');

// Test 3: Navigation validation
console.log('Test 3: Navigation validation');
assert(navigationController.canNavigate('main', 'settings'), 'Should allow main → settings');
assert(navigationController.canNavigate('settings', 'main'), 'Should allow settings → main');
assert(navigationController.canNavigate('settings', 'settings_ip'), 'Should allow settings → settings_ip');
assert(!navigationController.canNavigate('stats', 'settings_ip'), 'Should NOT allow stats → settings_ip');
console.log('✓ Navigation validation works correctly\n');

// Test 4: Back target
console.log('Test 4: Back target resolution');
assert(navigationController.getBackTarget('settings') === 'main', 'Settings should go back to main');
assert(navigationController.getBackTarget('settings_ip') === 'settings', 'Settings IP should go back to settings');
console.log('✓ Back target resolution works\n');

// Test 5: Wizard keyboard
console.log('Test 5: Wizard keyboard');
const wizardKeyboard = navigationController.createWizardKeyboard(
  2, // step 2
  3, // of 3 total
  [
    [{ text: 'Option 1', callback_data: 'opt1' }],
    [{ text: 'Option 2', callback_data: 'opt2' }]
  ]
);
assert(wizardKeyboard.reply_markup.inline_keyboard, 'Wizard keyboard should be inline');

// Should have cancel and back buttons
const wizardButtons = wizardKeyboard.reply_markup.inline_keyboard;
const hasCancelButton = wizardButtons.some(row => 
  row.some(btn => btn.callback_data === 'wizard_cancel')
);
const hasBackButton = wizardButtons.some(row => 
  row.some(btn => btn.callback_data === 'wizard_back')
);
assert(hasCancelButton, 'Wizard should have Cancel button');
assert(hasBackButton, 'Wizard step 2 should have Back button');
console.log('✓ Wizard keyboard has cancel and back buttons\n');

// Test 6: Wizard keyboard - first step (no back button)
console.log('Test 6: Wizard keyboard - first step');
const firstStepKeyboard = navigationController.createWizardKeyboard(
  1, // step 1
  3, // of 3 total
  [
    [{ text: 'Option 1', callback_data: 'opt1' }]
  ]
);
const firstStepButtons = firstStepKeyboard.reply_markup.inline_keyboard;
const hasBackButtonFirstStep = firstStepButtons.some(row => 
  row.some(btn => btn.callback_data === 'wizard_back')
);
assert(!hasBackButtonFirstStep, 'First wizard step should NOT have Back button');
console.log('✓ First wizard step has no back button\n');

// Test 7: Confirmation keyboard
console.log('Test 7: Confirmation keyboard');
const confirmKeyboard = navigationController.createConfirmationKeyboard(
  'action_confirm',
  'action_cancel'
);
const confirmButtons = confirmKeyboard.reply_markup.inline_keyboard;
assert(confirmButtons.length >= 2, 'Should have at least 2 rows');
assert(confirmButtons[0].length === 2, 'First row should have 2 buttons (confirm/cancel)');

const hasConfirm = confirmButtons[0].some(btn => btn.callback_data === 'action_confirm');
const hasCancelBtn = confirmButtons[0].some(btn => btn.callback_data === 'action_cancel');
assert(hasConfirm, 'Should have confirm button');
assert(hasCancelBtn, 'Should have cancel button');
console.log('✓ Confirmation keyboard has confirm and cancel\n');

// Test 8: Error keyboard
console.log('Test 8: Error keyboard (section 16.3 - errors must have navigation)');
const errorKeyboard = navigationController.createErrorKeyboard('retry_action');
const errorButtons = errorKeyboard.reply_markup.inline_keyboard;

const hasRetry = errorButtons.some(row => 
  row.some(btn => btn.callback_data === 'retry_action')
);
const hasMenuInError = errorButtons.some(row => 
  row.some(btn => btn.callback_data === 'back_to_main')
);
assert(hasRetry, 'Error keyboard should have retry button');
assert(hasMenuInError, 'Error keyboard MUST have menu button (spec 16.3)');
console.log('✓ Error keyboard has retry and menu buttons\n');

console.log('═══════════════════════════════════════');
console.log('✅ ВСІ ТЕСТИ ПРОЙДЕНО УСПІШНО!');
console.log('═══════════════════════════════════════\n');
console.log('✨ Navigation Controller готовий до використання!');
