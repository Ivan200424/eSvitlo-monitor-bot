/**
 * Metrics Collection for Load Testing
 * Збирає та агрегує метрики під час тестування
 */

class MetricsCollector {
  constructor(testName) {
    this.testName = testName;
    this.startTime = Date.now();
    this.endTime = null;
    
    // Metrics
    this.responseTimes = [];
    this.errors = [];
    this.duplicates = [];
    this.activeSchedulers = 0;
    this.memorySnapshots = [];
    this.cpuSnapshots = [];
    this.messagesSent = 0;
    this.messagesReceived = 0;
  }

  /**
   * Записати час відповіді
   */
  recordResponseTime(duration, operation = 'unknown') {
    this.responseTimes.push({ duration, operation, timestamp: Date.now() });
  }

  /**
   * Записати помилку
   */
  recordError(error, context = {}) {
    this.errors.push({
      message: error.message || error,
      stack: error.stack,
      context,
      timestamp: Date.now()
    });
  }

  /**
   * Записати дубльоване повідомлення
   */
  recordDuplicate(messageId, userId) {
    this.duplicates.push({ messageId, userId, timestamp: Date.now() });
  }

  /**
   * Оновити кількість активних scheduler'ів
   */
  updateSchedulers(count) {
    this.activeSchedulers = count;
  }

  /**
   * Записати snapshot пам'яті
   */
  recordMemorySnapshot() {
    const used = process.memoryUsage();
    this.memorySnapshots.push({
      timestamp: Date.now(),
      heapUsed: used.heapUsed,
      heapTotal: used.heapTotal,
      external: used.external,
      rss: used.rss
    });
  }

  /**
   * Записати snapshot CPU
   */
  recordCPUSnapshot(cpuUsage) {
    this.cpuSnapshots.push({
      timestamp: Date.now(),
      user: cpuUsage.user,
      system: cpuUsage.system
    });
  }

  /**
   * Збільшити лічильник надісланих повідомлень
   */
  incrementMessagesSent() {
    this.messagesSent++;
  }

  /**
   * Збільшити лічильник отриманих повідомлень
   */
  incrementMessagesReceived() {
    this.messagesReceived++;
  }

  /**
   * Завершити збір метрик
   */
  finish() {
    this.endTime = Date.now();
  }

  /**
   * Отримати статистику
   */
  getStats() {
    const duration = (this.endTime || Date.now()) - this.startTime;
    
    // Статистика по часу відповіді
    const responseTimes = this.responseTimes.map(r => r.duration);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
    const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
    const p95ResponseTime = this.calculatePercentile(responseTimes, 95);
    const p99ResponseTime = this.calculatePercentile(responseTimes, 99);

    // Статистика по пам'яті
    const memoryGrowth = this.calculateMemoryGrowth();
    
    return {
      testName: this.testName,
      duration,
      responseTime: {
        avg: avgResponseTime,
        min: minResponseTime,
        max: maxResponseTime,
        p95: p95ResponseTime,
        p99: p99ResponseTime,
        count: responseTimes.length
      },
      errors: {
        count: this.errors.length,
        list: this.errors
      },
      duplicates: {
        count: this.duplicates.length,
        list: this.duplicates
      },
      schedulers: {
        current: this.activeSchedulers
      },
      memory: {
        growth: memoryGrowth,
        snapshots: this.memorySnapshots.length
      },
      messages: {
        sent: this.messagesSent,
        received: this.messagesReceived
      }
    };
  }

  /**
   * Обчислити перцентиль
   */
  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  /**
   * Обчислити ріст пам'яті
   */
  calculateMemoryGrowth() {
    if (this.memorySnapshots.length < 2) return { absolute: 0, percentage: 0 };
    
    const first = this.memorySnapshots[0];
    const last = this.memorySnapshots[this.memorySnapshots.length - 1];
    
    const absolute = last.heapUsed - first.heapUsed;
    const percentage = (absolute / first.heapUsed) * 100;
    
    return { absolute, percentage };
  }

  /**
   * Перевірити критерії успіху
   */
  checkSuccessCriteria() {
    const stats = this.getStats();
    const failures = [];

    // Критерій 1: Час відповіді < 2 секунд (p95)
    if (stats.responseTime.p95 > 2000) {
      failures.push(`P95 response time ${stats.responseTime.p95}ms > 2000ms`);
    }

    // Критерій 2: Немає дубльованих повідомлень
    if (stats.duplicates.count > 0) {
      failures.push(`Found ${stats.duplicates.count} duplicate messages`);
    }

    // Критерій 3: Кількість помилок < 1%
    const errorRate = stats.messages.sent > 0 
      ? (stats.errors.count / stats.messages.sent) * 100 
      : 0;
    if (errorRate > 1) {
      failures.push(`Error rate ${errorRate.toFixed(2)}% > 1%`);
    }

    // Критерій 4: Ріст пам'яті < 50%
    if (stats.memory.growth.percentage > 50) {
      failures.push(`Memory growth ${stats.memory.growth.percentage.toFixed(2)}% > 50%`);
    }

    return {
      passed: failures.length === 0,
      failures
    };
  }

  /**
   * Згенерувати звіт
   */
  generateReport() {
    const stats = this.getStats();
    const criteria = this.checkSuccessCriteria();
    
    let report = `\n${'='.repeat(60)}\n`;
    report += `LOAD TEST REPORT: ${this.testName}\n`;
    report += `${'='.repeat(60)}\n\n`;
    
    report += `Duration: ${(stats.duration / 1000).toFixed(2)}s\n\n`;
    
    report += `Response Time:\n`;
    report += `  Average: ${stats.responseTime.avg.toFixed(2)}ms\n`;
    report += `  Min: ${stats.responseTime.min}ms\n`;
    report += `  Max: ${stats.responseTime.max}ms\n`;
    report += `  P95: ${stats.responseTime.p95}ms\n`;
    report += `  P99: ${stats.responseTime.p99}ms\n`;
    report += `  Total requests: ${stats.responseTime.count}\n\n`;
    
    report += `Messages:\n`;
    report += `  Sent: ${stats.messages.sent}\n`;
    report += `  Received: ${stats.messages.received}\n\n`;
    
    report += `Errors:\n`;
    report += `  Total: ${stats.errors.count}\n`;
    if (stats.errors.count > 0) {
      report += `  Recent:\n`;
      stats.errors.list.slice(-5).forEach(err => {
        report += `    - ${err.message}\n`;
      });
    }
    report += `\n`;
    
    report += `Duplicates: ${stats.duplicates.count}\n\n`;
    
    report += `Active Schedulers: ${stats.schedulers.current}\n\n`;
    
    report += `Memory:\n`;
    report += `  Growth: ${(stats.memory.growth.absolute / 1024 / 1024).toFixed(2)} MB (${stats.memory.growth.percentage.toFixed(2)}%)\n\n`;
    
    report += `${'='.repeat(60)}\n`;
    report += `TEST RESULT: ${criteria.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
    if (!criteria.passed) {
      report += `\nFailures:\n`;
      criteria.failures.forEach(f => report += `  - ${f}\n`);
    }
    report += `${'='.repeat(60)}\n`;
    
    return report;
  }
}

module.exports = { MetricsCollector };
