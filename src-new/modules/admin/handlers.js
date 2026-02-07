// Admin module handlers
import * as storage from '../../services/storage.js';
import * as keyboards from '../../ui/keyboards/inline.js';
import { isAdmin } from '../../middlewares/admin.js';

export async function handleAdmin(ctx) {
  const telegramId = String(ctx.from.id);
  
  if (!isAdmin(telegramId)) {
    await ctx.reply('❌ Доступ заборонено');
    return;
  }
  
  await ctx.reply('👑 Адмін-панель', keyboards.getAdminKeyboard());
}

export async function handleStats(ctx) {
  const users = storage.getAllUsers();
  const activeUsers = storage.getActiveUsers();
  
  await ctx.reply(
    '📊 Статистика\n\n' +
    `Всього користувачів: ${users.length}\n` +
    `Активних: ${activeUsers.length}`
  );
}
