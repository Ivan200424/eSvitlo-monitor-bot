/**
 * Mock Telegram Bot for Load Testing
 * Симулює Telegram Bot API без реального підключення
 */

const EventEmitter = require('events');

class MockTelegramBot extends EventEmitter {
  constructor(token, options = {}) {
    super();
    this.token = token;
    this.options = options;
    this.isPolling = false;
    
    // Зберігання надісланих повідомлень для перевірки
    this.sentMessages = [];
    this.editedMessages = [];
    this.deletedMessages = [];
    this.answeredCallbacks = [];
    
    // Імітація затримки мережі
    this.networkDelay = options.networkDelay || 10; // ms
    
    // Імітація помилок
    this.errorRate = options.errorRate || 0; // 0-1 (0 = no errors, 1 = all errors)
    
    // Лічильники для метрик
    this.stats = {
      messagesSent: 0,
      messagesEdited: 0,
      messagesDeleted: 0,
      callbacksAnswered: 0,
      errors: 0
    };
  }

  /**
   * Симулювати затримку мережі
   */
  async simulateNetworkDelay() {
    if (this.networkDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.networkDelay));
    }
  }

  /**
   * Симулювати випадкову помилку
   */
  shouldSimulateError() {
    return Math.random() < this.errorRate;
  }

  /**
   * Надіслати повідомлення
   */
  async sendMessage(chatId, text, options = {}) {
    await this.simulateNetworkDelay();
    
    if (this.shouldSimulateError()) {
      this.stats.errors++;
      throw new Error('Telegram API Error: Failed to send message');
    }
    
    const message = {
      message_id: Math.floor(Math.random() * 1000000),
      chat: { id: chatId },
      text,
      date: Math.floor(Date.now() / 1000),
      ...options
    };
    
    this.sentMessages.push(message);
    this.stats.messagesSent++;
    
    return message;
  }

  /**
   * Редагувати повідомлення
   */
  async editMessageText(text, options = {}) {
    await this.simulateNetworkDelay();
    
    if (this.shouldSimulateError()) {
      this.stats.errors++;
      throw new Error('Telegram API Error: Failed to edit message');
    }
    
    const message = {
      message_id: options.message_id,
      chat: { id: options.chat_id },
      text,
      date: Math.floor(Date.now() / 1000)
    };
    
    this.editedMessages.push(message);
    this.stats.messagesEdited++;
    
    return message;
  }

  /**
   * Видалити повідомлення
   */
  async deleteMessage(chatId, messageId) {
    await this.simulateNetworkDelay();
    
    if (this.shouldSimulateError()) {
      this.stats.errors++;
      throw new Error('Telegram API Error: Failed to delete message');
    }
    
    this.deletedMessages.push({ chatId, messageId });
    this.stats.messagesDeleted++;
    
    return true;
  }

  /**
   * Відповісти на callback query
   */
  async answerCallbackQuery(callbackQueryId, options = {}) {
    await this.simulateNetworkDelay();
    
    if (this.shouldSimulateError()) {
      this.stats.errors++;
      throw new Error('Telegram API Error: Failed to answer callback');
    }
    
    this.answeredCallbacks.push({ callbackQueryId, ...options });
    this.stats.callbacksAnswered++;
    
    return true;
  }

  /**
   * Отримати інформацію про чат
   */
  async getChat(chatId) {
    await this.simulateNetworkDelay();
    
    if (this.shouldSimulateError()) {
      this.stats.errors++;
      throw new Error('Telegram API Error: Failed to get chat');
    }
    
    return {
      id: chatId,
      type: chatId < 0 ? 'channel' : 'private',
      title: `Chat ${chatId}`
    };
  }

  /**
   * Отримати інформацію про адміністраторів чату
   */
  async getChatAdministrators(chatId) {
    await this.simulateNetworkDelay();
    
    if (this.shouldSimulateError()) {
      this.stats.errors++;
      throw new Error('Telegram API Error: Failed to get chat administrators');
    }
    
    return [
      {
        user: { id: 123456789, username: 'admin' },
        status: 'administrator',
        can_post_messages: true
      }
    ];
  }

  /**
   * Отримати інформацію про бота
   */
  async getMe() {
    await this.simulateNetworkDelay();
    
    return {
      id: 987654321,
      is_bot: true,
      first_name: 'Test Bot',
      username: 'test_bot'
    };
  }

  /**
   * Симулювати вхідне повідомлення від користувача
   */
  simulateMessage(chatId, text, options = {}) {
    const message = {
      message_id: Math.floor(Math.random() * 1000000),
      from: {
        id: chatId,
        is_bot: false,
        first_name: `User${chatId}`
      },
      chat: { id: chatId, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text,
      ...options
    };
    
    this.emit('message', message);
    return message;
  }

  /**
   * Симулювати callback query
   */
  simulateCallbackQuery(chatId, data, options = {}) {
    const callbackQuery = {
      id: Math.floor(Math.random() * 1000000).toString(),
      from: {
        id: chatId,
        is_bot: false,
        first_name: `User${chatId}`
      },
      message: {
        message_id: Math.floor(Math.random() * 1000000),
        chat: { id: chatId },
        date: Math.floor(Date.now() / 1000)
      },
      data,
      ...options
    };
    
    this.emit('callback_query', callbackQuery);
    return callbackQuery;
  }

  /**
   * Симулювати масові повідомлення
   */
  async simulateMassMessages(chatIds, text) {
    const promises = chatIds.map(chatId => 
      new Promise(resolve => {
        setTimeout(() => {
          this.simulateMessage(chatId, text);
          resolve();
        }, Math.random() * 1000); // Розподілити в часі
      })
    );
    
    await Promise.all(promises);
  }

  /**
   * Отримати статистику
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Скинути статистику
   */
  resetStats() {
    this.stats = {
      messagesSent: 0,
      messagesEdited: 0,
      messagesDeleted: 0,
      callbacksAnswered: 0,
      errors: 0
    };
    this.sentMessages = [];
    this.editedMessages = [];
    this.deletedMessages = [];
    this.answeredCallbacks = [];
  }

  /**
   * Перевірити на дубльовані повідомлення
   */
  checkForDuplicates() {
    const duplicates = [];
    const seen = new Map();
    
    for (const msg of this.sentMessages) {
      const key = `${msg.chat.id}:${msg.text}`;
      if (seen.has(key)) {
        duplicates.push({
          chatId: msg.chat.id,
          text: msg.text,
          count: seen.get(key) + 1
        });
        seen.set(key, seen.get(key) + 1);
      } else {
        seen.set(key, 1);
      }
    }
    
    return duplicates;
  }

  /**
   * Запустити polling (для сумісності)
   */
  startPolling() {
    this.isPolling = true;
  }

  /**
   * Зупинити polling (для сумісності)
   */
  stopPolling() {
    this.isPolling = false;
  }

  /**
   * on() method для подій (вже є від EventEmitter)
   */
  
  /**
   * Обробник команд (для зручності)
   */
  onText(regexp, callback) {
    this.on('message', (msg) => {
      if (msg.text && regexp.test(msg.text)) {
        callback(msg, regexp.exec(msg.text));
      }
    });
  }
}

module.exports = { MockTelegramBot };
