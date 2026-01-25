const db = require('./database/db');

// Додати запис про відключення
function addOutageRecord(userId, startTime, endTime) {
  try {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMinutes = Math.floor((end - start) / (1000 * 60));
    
    if (durationMinutes < 0) {
      console.error('Invalid outage duration: end time before start time');
      return false;
    }
    
    const stmt = db.prepare(`
      INSERT INTO outage_history (user_id, start_time, end_time, duration_minutes)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(userId, startTime, endTime, durationMinutes);
    return true;
  } catch (error) {
    console.error('Error adding outage record:', error);
    return false;
  }
}

// Отримати статистику за тиждень
function getWeeklyStats(userId) {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const stmt = db.prepare(`
      SELECT * FROM outage_history
      WHERE user_id = ? AND start_time >= ?
      ORDER BY start_time DESC
    `);
    
    const records = stmt.all(userId, weekAgo.toISOString());
    
    if (records.length === 0) {
      return {
        count: 0,
        totalMinutes: 0,
        avgMinutes: 0,
        longest: null,
        shortest: null,
      };
    }
    
    const totalMinutes = records.reduce((sum, r) => sum + r.duration_minutes, 0);
    const avgMinutes = Math.floor(totalMinutes / records.length);
    
    // Знайти найдовше і найкоротше
    let longest = records[0];
    let shortest = records[0];
    
    records.forEach(record => {
      if (record.duration_minutes > longest.duration_minutes) {
        longest = record;
      }
      if (record.duration_minutes < shortest.duration_minutes) {
        shortest = record;
      }
    });
    
    return {
      count: records.length,
      totalMinutes,
      avgMinutes,
      longest,
      shortest,
    };
  } catch (error) {
    console.error('Error getting weekly stats:', error);
    return {
      count: 0,
      totalMinutes: 0,
      avgMinutes: 0,
      longest: null,
      shortest: null,
    };
  }
}

// Форматувати повідомлення статистики
function formatStatsMessage(stats) {
  if (stats.count === 0) {
    return '📊 Статистика за тиждень:\n\n✅ Відключень не було';
  }
  
  const lines = [];
  lines.push('📊 Статистика за тиждень:');
  lines.push('');
  lines.push(`⚡ Відключень: ${stats.count}`);
  
  // Форматувати загальний час
  const totalHours = Math.floor(stats.totalMinutes / 60);
  const totalMins = stats.totalMinutes % 60;
  if (totalHours > 0 && totalMins > 0) {
    lines.push(`🕓 Загальний час без світла: ${totalHours}год ${totalMins}хв`);
  } else if (totalHours > 0) {
    lines.push(`🕓 Загальний час без світла: ${totalHours}год`);
  } else {
    lines.push(`🕓 Загальний час без світла: ${totalMins}хв`);
  }
  
  // Середня тривалість
  const avgHours = Math.floor(stats.avgMinutes / 60);
  const avgMins = stats.avgMinutes % 60;
  if (avgHours > 0 && avgMins > 0) {
    lines.push(`📉 Середня тривалість: ${avgHours}год ${avgMins}хв`);
  } else if (avgHours > 0) {
    lines.push(`📉 Середня тривалість: ${avgHours}год`);
  } else {
    lines.push(`📉 Середня тривалість: ${avgMins}хв`);
  }
  
  // Найдовше відключення
  if (stats.longest) {
    const longHours = Math.floor(stats.longest.duration_minutes / 60);
    const longMins = stats.longest.duration_minutes % 60;
    const longDate = new Date(stats.longest.start_time);
    const longDateStr = `${String(longDate.getDate()).padStart(2, '0')}.${String(longDate.getMonth() + 1).padStart(2, '0')}`;
    const longStartTime = `${String(longDate.getHours()).padStart(2, '0')}:${String(longDate.getMinutes()).padStart(2, '0')}`;
    const longEndDate = new Date(stats.longest.end_time);
    const longEndTime = `${String(longEndDate.getHours()).padStart(2, '0')}:${String(longEndDate.getMinutes()).padStart(2, '0')}`;
    
    let durationStr = '';
    if (longHours > 0 && longMins > 0) {
      durationStr = `${longHours}год ${longMins}хв`;
    } else if (longHours > 0) {
      durationStr = `${longHours}год`;
    } else {
      durationStr = `${longMins}хв`;
    }
    
    lines.push(`🏆 Найдовше: ${durationStr} (${longDateStr} ${longStartTime}-${longEndTime})`);
  }
  
  // Найкоротше відключення
  if (stats.shortest) {
    const shortHours = Math.floor(stats.shortest.duration_minutes / 60);
    const shortMins = stats.shortest.duration_minutes % 60;
    const shortDate = new Date(stats.shortest.start_time);
    const shortDateStr = `${String(shortDate.getDate()).padStart(2, '0')}.${String(shortDate.getMonth() + 1).padStart(2, '0')}`;
    const shortStartTime = `${String(shortDate.getHours()).padStart(2, '0')}:${String(shortDate.getMinutes()).padStart(2, '0')}`;
    const shortEndDate = new Date(stats.shortest.end_time);
    const shortEndTime = `${String(shortEndDate.getHours()).padStart(2, '0')}:${String(shortEndDate.getMinutes()).padStart(2, '0')}`;
    
    let durationStr = '';
    if (shortHours > 0 && shortMins > 0) {
      durationStr = `${shortHours}год ${shortMins}хв`;
    } else if (shortHours > 0) {
      durationStr = `${shortHours}год`;
    } else {
      durationStr = `${shortMins}хв`;
    }
    
    lines.push(`🔋 Найкоротше: ${durationStr} (${shortDateStr} ${shortStartTime}-${shortEndTime})`);
  }
  
  return lines.join('\n');
}

module.exports = {
  addOutageRecord,
  getWeeklyStats,
  formatStatsMessage,
};
