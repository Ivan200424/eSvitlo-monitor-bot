// In-memory session store (can be replaced with DB-based storage)
const sessions = new Map();

export function session() {
  return async (ctx, next) => {
    const sessionKey = ctx.from?.id?.toString();
    
    if (!sessionKey) {
      return next();
    }
    
    // Get or create session
    if (!sessions.has(sessionKey)) {
      sessions.set(sessionKey, {});
    }
    
    ctx.session = sessions.get(sessionKey);
    
    await next();
  };
}

export function getSession(userId) {
  return sessions.get(userId?.toString()) || {};
}

export function setSession(userId, data) {
  sessions.set(userId?.toString(), data);
}

export function clearSession(userId) {
  sessions.delete(userId?.toString());
}
