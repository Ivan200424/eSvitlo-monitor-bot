# Quick Start - Load Testing

## Швидкий старт без встановлення залежностей

Якщо ви хочете швидко протестувати load testing framework без встановлення залежностей бота (better-sqlite3 може мати проблеми компіляції):

```bash
# Standalone тест - тестує тільки framework
node tests/load-testing/standalone-test.js SMALL
node tests/load-testing/standalone-test.js MEDIUM
node tests/load-testing/standalone-test.js HIGH
```

Цей тест перевіряє:
- ✅ Mock Telegram Bot працює
- ✅ Метрики збираються коректно
- ✅ Генератори даних працюють
- ✅ Немає дубльованих повідомлень
- ✅ Response time в межах норми

## Повні тести з ботом

Для запуску повних тестів з реальним кодом бота:

### 1. Встановити залежності

```bash
npm install
```

### 2. Запустити тести

```bash
# Окремі сценарії
npm run load-test:small
npm run load-test:medium
npm run load-test:high

# Всі рівні
npm run load-test:all

# Soak test
npm run load-test:soak
```

## Що тестується

### Standalone Test
- Mock bot API
- Message sending/editing/deleting
- Callback queries
- Duplicate detection
- Memory usage
- Response time metrics

### Full Tests (з ботом)
- Mass /start command
- Wizard under load
- Mass graph updates
- IP monitoring (debounce)
- Channel publications
- Pause mode
- Recovery after restart
- Soak testing (24-72h)

## Результати

Всі результати зберігаються в `tests/load-testing/reports/`

Формат звіту:
```
LOAD TEST REPORT: [Test Name]
Duration: Xs
Response Time: avg/min/max/p95/p99
Messages: sent/received
Errors: count
Duplicates: count
Memory: growth
TEST RESULT: ✅ PASSED / ❌ FAILED
```

## Критерії успіху

✅ P95 response time < 2000ms  
✅ 0 duplicates  
✅ Error rate < 1%  
✅ Memory growth < 50%  
✅ No crashes

## Troubleshooting

### better-sqlite3 не компілюється

Використайте standalone test:
```bash
node tests/load-testing/standalone-test.js SMALL
```

### Недостатньо пам'яті

Зменшіть рівень навантаження:
```bash
node tests/load-testing/standalone-test.js SMALL  # 50 users
# замість MEDIUM (300 users)
```

### Занадто довго виконується

Запустіть окремий тест швидше:
```bash
node tests/load-testing/standalone-test.js SMALL  # ~1 секунда
```

## Детальна документація

Див. [LOAD_TESTING_GUIDE.md](../../../LOAD_TESTING_GUIDE.md)
