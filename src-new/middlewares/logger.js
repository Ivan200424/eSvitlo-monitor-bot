// Simple logger middleware for grammY
export function logger() {
  return async (ctx, next) => {
    const start = Date.now();
    const updateType = ctx.update.message ? 'message' :
                      ctx.update.callback_query ? 'callback' :
                      ctx.update.my_chat_member ? 'chat_member' :
                      'other';
    
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    
    try {
      await next();
      const duration = Date.now() - start;
      console.log(`✓ ${updateType} ${userId} ${chatId} ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`✗ ${updateType} ${userId} ${chatId} ${duration}ms:`, error.message);
      throw error;
    }
  };
}
