// Settings module handlers
import * as storage from '../../services/storage.js';
import * as keyboards from '../../ui/keyboards/inline.js';

export async function handleSettings(ctx) {
  await ctx.reply('⚙️ Налаштування', keyboards.getSettingsKeyboard());
}

export async function handleRegionChange(ctx) {
  await ctx.reply('Зміна регіону в розробці');
}

export async function handleIpSetup(ctx) {
  await ctx.reply('IP моніторинг в розробці');
}
