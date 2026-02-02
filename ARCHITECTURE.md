# Telegram Web App Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         TELEGRAM USER                            │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
            ┌───────▼────────┐    ┌────────▼────────┐
            │  Telegram Bot  │    │   Web App       │
            │   (Commands)   │    │  (Mini App)     │
            └───────┬────────┘    └────────┬────────┘
                    │                      │
                    │         Railway      │
┌───────────────────┴──────────────────────┴──────────────────────┐
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               Node.js Application                         │  │
│  │                                                            │  │
│  │  ┌─────────────────┐          ┌──────────────────────┐  │  │
│  │  │   Bot Process   │          │   Express Server     │  │  │
│  │  │                 │          │   (Port 3000)        │  │  │
│  │  │  • Commands     │          │                      │  │  │
│  │  │  • Handlers     │          │  • Static Files      │  │  │
│  │  │  • Scheduler    │          │  • API Routes        │  │  │
│  │  │  • Alerts       │          │  • Rate Limiting     │  │  │
│  │  └─────────┬───────┘          └──────────┬───────────┘  │  │
│  │            │                              │               │  │
│  │            │     ┌───────────────────────┘               │  │
│  │            │     │                                        │  │
│  │            ▼     ▼                                        │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │              Database Layer                         │ │  │
│  │  │           (better-sqlite3)                          │ │  │
│  │  │                                                      │ │  │
│  │  │  • users.js      - User management                 │ │  │
│  │  │  • db.js         - Database connection             │ │  │
│  │  │  • Settings      - System settings                 │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Web App Component Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                      Telegram Mini App                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                    Frontend (SPA)                       │   │
│  │                                                          │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │          index.html (UI Structure)              │  │   │
│  │  │                                                  │  │   │
│  │  │  • Loading Screen                               │  │   │
│  │  │  • Error Screen                                 │  │   │
│  │  │  • User Settings                                │  │   │
│  │  │  • Admin Panel                                  │  │   │
│  │  └─────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │       style.css (iOS 26 Styling)                │  │   │
│  │  │                                                  │  │   │
│  │  │  • Glassmorphism Effects                        │  │   │
│  │  │  • Telegram Theme Variables                     │  │   │
│  │  │  • Responsive Layout                            │  │   │
│  │  │  • Animations                                   │  │   │
│  │  └─────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │        app.js (Application Logic)               │  │   │
│  │  │                                                  │  │   │
│  │  │  • Telegram Web App SDK                         │  │   │
│  │  │  • API Communication                            │  │   │
│  │  │  • State Management                             │  │   │
│  │  │  • Event Handlers                               │  │   │
│  │  └─────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              │
┌────────────────────────────────────────────────────────────────┐
│                      Express Server                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                   Middleware Stack                        │ │
│  │                                                            │ │
│  │  1. CORS Headers                                          │ │
│  │  2. Rate Limiting (express-rate-limit)                   │ │
│  │  3. JSON Parser                                           │ │
│  │  4. URL Encoded Parser                                    │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    API Routes                             │ │
│  │                                                            │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │  /api/*                                             │ │ │
│  │  │                                                      │ │ │
│  │  │  • authMiddleware (HMAC-SHA256)                    │ │ │
│  │  │                                                      │ │ │
│  │  │  ├─ /user              GET    (User data)          │ │ │
│  │  │  ├─ /user/region       POST   (Update region)      │ │ │
│  │  │  ├─ /user/ip           POST   (Update IP)          │ │ │
│  │  │  ├─ /user/alerts       POST   (Update alerts)      │ │ │
│  │  │  ├─ /user/schedule-alerts POST (Schedule alerts)   │ │ │
│  │  │  ├─ /user/delete       POST   (Delete user)        │ │ │
│  │  │  ├─ /regions           GET    (List regions)       │ │ │
│  │  │  └─ /queues            GET    (List queues)        │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │  /api/admin/*                                       │ │ │
│  │  │                                                      │ │ │
│  │  │  • authMiddleware + adminMiddleware                │ │ │
│  │  │                                                      │ │ │
│  │  │  ├─ /stats            GET    (Statistics)          │ │ │
│  │  │  ├─ /system           GET    (System info)         │ │ │
│  │  │  ├─ /intervals        GET    (Get intervals)       │ │ │
│  │  │  ├─ /intervals        POST   (Update intervals)    │ │ │
│  │  │  └─ /broadcast        POST   (Send broadcast)      │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                Static File Serving                        │ │
│  │                                                            │ │
│  │  • /                  →  index.html                       │ │
│  │  • /css/style.css     →  CSS file                        │ │
│  │  • /js/app.js         →  JavaScript                      │ │
│  │  • /*                 →  SPA fallback to index.html      │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

## Authentication Flow

```
┌──────────────┐                                    ┌──────────────┐
│   Telegram   │                                    │  Web App     │
│   Platform   │                                    │  (Browser)   │
└──────┬───────┘                                    └──────┬───────┘
       │                                                   │
       │  1. User opens Web App                           │
       │─────────────────────────────────────────────────→│
       │                                                   │
       │  2. Telegram.WebApp.initData                     │
       │←─────────────────────────────────────────────────│
       │                                                   │
                                                           │
                                                           │ 3. API Request
                                                           │    + initData
                                                           ▼
                                                    ┌──────────────┐
                                                    │  Express     │
                                                    │  Server      │
                                                    └──────┬───────┘
                                                           │
                                                           │ 4. Auth Middleware
                                                           ▼
                                                    ┌──────────────┐
                                                    │ Verify HMAC  │
                                                    │              │
    ┌────────────────────────────────────────────→ │ • Parse data │
    │                                                │ • Hash check │
    │  BOT_TOKEN                                    │ • Expiry     │
    │                                                └──────┬───────┘
    │                                                       │
    │                                              ┌────────┴────────┐
    │                                              │                 │
    │                                         Valid?            Invalid?
    │                                              │                 │
    │                                              ▼                 ▼
    │                                        ┌─────────┐      ┌──────────┐
    │                                        │ Process │      │ Return   │
    │                                        │ Request │      │ 401      │
    │                                        └────┬────┘      └──────────┘
    │                                             │
    │                                             │ 5. Check Admin (if needed)
    │                                             ▼
    │                                      ┌──────────────┐
    │                                      │ Admin Check  │
    └──────────────────────────────────────┤              │
                                           │ ADMIN_IDS or │
                                           │ ownerId      │
                                           └──────┬───────┘
                                                  │
                                        ┌─────────┴─────────┐
                                        │                   │
                                    Authorized        Unauthorized
                                        │                   │
                                        ▼                   ▼
                                   ┌─────────┐        ┌─────────┐
                                   │ 200 OK  │        │ 403     │
                                   │ + Data  │        │Forbidden│
                                   └─────────┘        └─────────┘
```

## Data Flow - User Settings Update

```
┌──────────────┐
│   User UI    │
│              │
│ [Change      │
│  Region]     │
│              │
│ [Save Button]│
└──────┬───────┘
       │
       │ 1. Click Event
       ▼
┌──────────────┐
│  app.js      │
│              │
│ Validate     │
│ input        │
└──────┬───────┘
       │
       │ 2. POST /api/user/region
       │    { region: 'kyiv', queue: '1.1' }
       │    Header: x-telegram-init-data
       ▼
┌──────────────┐
│  Express     │
│  Server      │
│              │
│ Rate Limit   │◄── Check: Within limits?
│ Check        │
└──────┬───────┘
       │
       │ 3. Auth Middleware
       ▼
┌──────────────┐
│  Verify      │
│  initData    │
│              │
│ HMAC-SHA256  │◄── BOT_TOKEN secret
└──────┬───────┘
       │
       │ 4. Route Handler
       ▼
┌──────────────┐
│  Validate    │
│  Parameters  │
│              │
│ • Region in  │
│   REGIONS?   │
│ • Queue in   │
│   QUEUES?    │
└──────┬───────┘
       │
       │ 5. Database Update
       ▼
┌──────────────┐
│  users.js    │
│              │
│ UPDATE users │
│ SET region=?,│
│     queue=?  │
│ WHERE        │
│ telegram_id=?│
└──────┬───────┘
       │
       │ 6. Response
       ▼
┌──────────────┐
│  200 OK      │
│              │
│ { success:   │
│   true }     │
└──────┬───────┘
       │
       │ 7. UI Update
       ▼
┌──────────────┐
│  Show Toast  │
│              │
│ "✅ Регіон   │
│  оновлено"   │
└──────────────┘
```

## Rate Limiting Architecture

```
┌────────────────────────────────────────────┐
│           Rate Limiter Middleware          │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │     Static Files Limiter             │ │
│  │     200 requests / 15 minutes        │ │
│  │     Applied to: webapp/*             │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │     General API Limiter              │ │
│  │     100 requests / 15 minutes        │ │
│  │     Applied to: /api/*               │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │     Auth API Limiter                 │ │
│  │     20 requests / 15 minutes         │ │
│  │     Applied to: /api/*, /api/admin/* │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  Implementation:                           │
│  • IP-based tracking                       │
│  • Sliding window algorithm                │
│  • Standard headers (RateLimit-*)          │
│  • Custom error messages in Ukrainian      │
└────────────────────────────────────────────┘
```

## Deployment on Railway

```
┌─────────────────────────────────────────────────────────────┐
│                      Railway Platform                        │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                 GitHub Integration                      │ │
│  │                                                          │ │
│  │  Repository: Ivan200424/eSvitlo-monitor-bot            │ │
│  │  Branch: main (or feature branch)                      │ │
│  │  Auto-deploy on push                                   │ │
│  └───────────────────────┬────────────────────────────────┘ │
│                          │                                   │
│                          │ Push event                        │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    Build Process                        │ │
│  │                                                          │ │
│  │  1. npm install                                         │ │
│  │  2. Provision database volume                          │ │
│  │  3. Set environment variables                          │ │
│  └───────────────────────┬────────────────────────────────┘ │
│                          │                                   │
│                          │ Build complete                    │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  Start Application                      │ │
│  │                                                          │ │
│  │  Command: npm start                                     │ │
│  │  Process: node src/index.js                            │ │
│  │                                                          │ │
│  │  ┌──────────────────┐    ┌──────────────────┐         │ │
│  │  │   Bot Process    │    │  Express Server  │         │ │
│  │  │   (Telegram)     │    │  (Port: $PORT)   │         │ │
│  │  └──────────────────┘    └──────────────────┘         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                 Public URL Assignment                   │ │
│  │                                                          │ │
│  │  HTTPS: https://your-app.railway.app                   │ │
│  │  Certificate: Auto-managed                              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Internet
                          ▼
                  ┌───────────────┐
                  │  Telegram     │
                  │  Users        │
                  └───────────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Security Stack                        │
│                                                           │
│  Layer 1: Transport Security                             │
│  ┌────────────────────────────────────────────────────┐ │
│  │  • HTTPS/TLS 1.2+                                  │ │
│  │  • Certificate from Railway                        │ │
│  │  • Encrypted in transit                            │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  Layer 2: Rate Limiting                                  │
│  ┌────────────────────────────────────────────────────┐ │
│  │  • IP-based limits                                 │ │
│  │  • Sliding window                                  │ │
│  │  • DDoS mitigation                                 │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  Layer 3: Authentication                                 │
│  ┌────────────────────────────────────────────────────┐ │
│  │  • Telegram initData                               │ │
│  │  • HMAC-SHA256 signature                           │ │
│  │  • 1-hour expiry                                   │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  Layer 4: Authorization                                  │
│  ┌────────────────────────────────────────────────────┐ │
│  │  • Admin ID verification                           │ │
│  │  • Owner ID check                                  │ │
│  │  • Endpoint protection                             │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  Layer 5: Input Validation                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │  • Type checking                                   │ │
│  │  • Range validation                                │ │
│  │  • Whitelist approach                              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  Layer 6: Data Protection                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │  • Prepared statements                             │ │
│  │  • No raw SQL                                      │ │
│  │  • SQL injection prevention                        │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Technology Stack

```
┌────────────────────────────────────────────────────────┐
│                    Frontend Layer                       │
│                                                          │
│  • HTML5 (Semantic markup)                              │
│  • CSS3 (Modern features: backdrop-filter, grid)        │
│  • Vanilla JavaScript (ES6+)                            │
│  • Telegram Web App SDK                                 │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                    Backend Layer                        │
│                                                          │
│  • Node.js (v20+)                                       │
│  • Express.js (v4.18.2)                                 │
│  • express-rate-limit (v7.1.5)                          │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                    Database Layer                       │
│                                                          │
│  • better-sqlite3 (v9.2.2)                              │
│  • SQLite (File-based)                                  │
│  • Prepared statements                                  │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                    Bot Layer                            │
│                                                          │
│  • node-telegram-bot-api (v0.64.0)                      │
│  • Long polling                                         │
│  • Graceful shutdown                                    │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                 Infrastructure Layer                    │
│                                                          │
│  • Railway (PaaS)                                       │
│  • GitHub (Version control)                             │
│  • HTTPS (TLS certificate)                              │
└────────────────────────────────────────────────────────┘
```

---

**Architecture Version:** 1.0  
**Last Updated:** 2026-02-02  
**Status:** Production Ready ✅
