# Quick Reference: Schedule Publication Logic

## 🎯 Main Principle
> **Publish ONLY new or changed information**
> 
> Calendar day transition alone is NOT a reason to publish

## 📊 State Fields

```javascript
user.schedule_hash_today          // Hash of today's schedule
user.schedule_hash_tomorrow       // Hash of tomorrow's schedule
user.last_published_date_today    // "2026-02-05"
user.last_published_date_tomorrow // "2026-02-06"
```

## 🔄 Day Transition (at 00:00)

```
tomorrow → today
null → tomorrow
```

## 🔍 Change Detection

```javascript
if (new_hash !== saved_hash) {
  // Publish update
} else {
  // Don't publish
}
```

## 📝 Message Headers

| Scenario | Header |
|----------|--------|
| First today | 📊 Графік відключень на сьогодні, {date} ({day}), для черги {queue}: |
| Update today | 💡 Оновлено графік відключень на сьогодні, {date} ({day}), для черги {queue}: |
| First tomorrow | 💡 Зʼявився графік відключень на завтра, {date} ({day}), для черги {queue}: |
| Tomorrow + unchanged today | Two blocks: tomorrow + "Графік на сьогодні — без змін:" |

## ✅ Publish When

- ✅ First appearance (hash = null → hash = "abc")
- ✅ Today changed (hash = "abc" → hash = "def")
- ✅ Tomorrow changed (hash = "abc" → hash = "def")

## ❌ Don't Publish When

- ❌ No changes (hash = "abc" → hash = "abc")
- ❌ Day transition without new data
- ❌ Bot restart (same hashes as in DB)

## 🧪 Test Commands

```bash
# All tests
node test-schedule-publication-logic.js
node test-logic-only.js

# Specific checks
node -c src/scheduler.js  # Syntax check
node -c src/formatter.js  # Syntax check
```

## 🗂️ Key Files

```
src/
├── scheduler.js        # checkUserSchedule() - main logic
├── formatter.js        # formatScheduleMessageNew() - messages
├── publisher.js        # publishScheduleWithPhotoNew() - channel
├── database/
│   ├── users.js       # updateScheduleState(), transitionScheduleDay()
│   └── db.js          # Database fields migration
└── utils.js           # calculateScheduleHash() - hash function
```

## 📖 Documentation

- 📘 IMPLEMENTATION_SCHEDULE_PUBLICATION_LOGIC.md - Full technical docs
- 📙 VISUAL_GUIDE_SCHEDULE_PUBLICATION.md - Examples and comparisons  
- 📕 SECURITY_SUMMARY_SCHEDULE_PUBLICATION.md - Security analysis

---

**Quick Start**: Read VISUAL_GUIDE_SCHEDULE_PUBLICATION.md first!
