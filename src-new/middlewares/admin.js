import { env } from '../config/env.js';

// Check if user is admin
export function isAdmin(userId) {
  const id = userId?.toString();
  return id === env.OWNER_ID || env.ADMIN_IDS.includes(id);
}

// Check if user is owner
export function isOwner(userId) {
  return userId?.toString() === env.OWNER_ID;
}

// Middleware to restrict commands to admins only
export function adminOnly() {
  return async (ctx, next) => {
    if (!isAdmin(ctx.from?.id)) {
      await ctx.reply('❌ Ця команда доступна тільки адміністраторам');
      return;
    }
    return next();
  };
}
