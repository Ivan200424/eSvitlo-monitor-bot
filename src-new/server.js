import express from 'express';
import { webhookCallback } from 'grammy';
import { env } from './config/env.js';

export function createServer(bot) {
  const app = express();
  
  // Parse JSON bodies
  app.use(express.json());
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      mode: 'webhook',
      timestamp: new Date().toISOString()
    });
  });
  
  // Webhook endpoint - grammY handles Telegram updates
  app.post('/webhook', webhookCallback(bot, 'http'));
  
  // Root endpoint
  app.get('/', (req, res) => {
    res.send('Вольтик Bot is running');
  });
  
  return app;
}

export function startServer(app, bot) {
  return new Promise((resolve, reject) => {
    const server = app.listen(env.PORT, async () => {
      console.log(`🌐 HTTP сервер запущено на порті ${env.PORT}`);
      
      try {
        // Initialize bot API first
        await bot.api.init();
        console.log('✅ Bot API ініціалізовано');
        
        // Set webhook
        const webhookUrl = `${env.WEBHOOK_URL}/webhook`;
        const webhookOptions = {
          url: webhookUrl,
          drop_pending_updates: false
        };
        
        if (env.WEBHOOK_SECRET) {
          webhookOptions.secret_token = env.WEBHOOK_SECRET;
        }
        
        await bot.api.setWebhook(webhookOptions.url, {
          secret_token: webhookOptions.secret_token
        });
        
        console.log(`✅ Webhook встановлено: ${webhookUrl}`);
        if (env.WEBHOOK_SECRET) {
          console.log('🔐 Secret token активовано');
        }
        
        resolve(server);
      } catch (error) {
        console.error('❌ Помилка встановлення webhook:', error);
        server.close();
        reject(error);
      }
    });
    
    server.on('error', reject);
  });
}

export async function stopServer(server, bot) {
  console.log('⏳ Зупинка HTTP сервера...');
  
  try {
    // Remove webhook
    await bot.api.deleteWebhook();
    console.log('✅ Webhook видалено');
  } catch (error) {
    console.error('Помилка видалення webhook:', error.message);
  }
  
  // Close HTTP server
  return new Promise((resolve) => {
    server.close(() => {
      console.log('✅ HTTP сервер зупинено');
      resolve();
    });
  });
}
