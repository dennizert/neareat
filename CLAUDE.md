# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NearEat** — mobile-first restaurant discovery platform. Monorepo with two packages:
- `neareat-backend/` — Node.js + Express + Prisma + PostgreSQL + Redis, deployed on Railway
- `neareat-mobile/` — React Native (Expo ~52 bare workflow) + Zustand, Android APK distributed manually

Three user roles: regular user, restaurant owner, admin. Turkish-language UI.

---

## Commands

### Backend (`neareat-backend/`)

```bash
npm run dev          # Nodemon dev server (port 3000)
npm start            # Run migrations then start (production)
npm test             # Full Jest suite (forceExit + detectOpenHandles)
npm test -- --testNamePattern="login"   # Run tests matching a pattern
npm test -- tests/api.test.js           # Run a single test file
npm run prisma:migrate   # Create + apply a new migration interactively
npm run prisma:studio    # Visual DB browser at localhost:5555
```

### Mobile (`neareat-mobile/`)

```bash
npm start            # Expo dev server
npm run android      # Build + run on Android emulator (expo run:android)
npm test             # Jest store tests
npm run test:stores  # Zustand store tests only
```

### Android APK release build

```bash
cd neareat-mobile/android
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
```

Railway deployment is triggered automatically on `git push origin master`.

---

## Architecture

### Backend request flow

```
requestId → helmet/CORS → morgan → rate-limit → body-parse → sanitize
  → routes → auth middleware (JWT or Firebase) → roles check → controller
  → service layer → Prisma/Redis/external APIs → errorHandler
```

- **Auth:** Dual strategy — `email + bcrypt + JWT` OR `Firebase Google OAuth`. Both produce the same JWT; `middleware/auth.js` validates it on protected routes.
- **Rate limiting:** `authRateLimit` (20 req/15 min) on auth routes; `userRateLimit` (120 req/min, keyed by userId post-auth) on API routes.
- **Caching:** Redis caches Google Places nearby queries (keys include lat/lng/radius/type). Also caches premium friend social signals (`social-signals:{userId}`, 15 min) to avoid recomputing on every AI call.
- **AI recommendations:** `services/recommendationService.js` calls Anthropic Claude via SSE streaming. `recommendationController.js` forwards the stream to the client with 15s keepalive pings to avoid Railway proxy timeouts.
- **Conversational refinement:** The streaming endpoint accepts `sessionId` + `refinement` ("daha ucuz/yakın/sessiz"). Session context (previously-suggested placeIds + refinement history) is kept in Redis (`rec-session:{id}`, 30 min) so previously-suggested places are excluded on follow-ups. See `services/recommendationSession.js`.
- **Feedback loop:** A weekly cron (`jobs/feedbackAggregator.js`) aggregates `RecommendationFeedback.placeTypes` into per-user liked/disliked cuisine types (`FeedbackPreference`), injected into the AI system prompt as `cuisinePreferences`.
- **Reservation escalation:** Hourly cron in `jobs/reservationReminders.js` finds `PENDING` reservations older than 24h (`pendingReminderSentAt IS NULL`), notifies the restaurant owner + user (`RESERVATION_PENDING_REMINDER`), and stamps `pendingReminderSentAt` for idempotency.
- **Restaurant B2B (`restaurant-account` routes):** `POST /campaign` sends an `INSTANT_DISCOUNT` push to favoriters/past-reservers (max 1/day via `RestaurantProfile.lastCampaignAt`). `GET /analytics` returns reservation trend / busiest hours / status breakdown / rating distribution (pure core in `utils/restaurantAnalytics.js`). `GET /report` turns that analytics into a short Turkish business summary via `services/businessReport.js` (claude-haiku-4-5, graceful fallback to a templated summary).

### Backend directory layout

```
src/
  controllers/   # Business logic (one file per domain)
  routes/        # Express routers (map HTTP → controllers)
  middleware/    # auth, roles, errorHandler, sanitize, securityLogger, userRateLimit, requestId
  services/      # External integrations: googlePlaces, firebase, redis, resend, anthropic, iyzico
  jobs/          # Cron: reservationReminders, smartNotifications, feedbackAggregator
  utils/         # prisma client, jwt helpers, haversine, contentFilter
prisma/
  schema.prisma  # Single source of truth for DB models
  seed*.js       # Seed scripts (seed.js, seed-users.js, seed-social-test.js)
tests/
  setup.js       # Mocks Firebase/Resend/Anthropic before all tests
  api.test.js    # Main integration test file (~500 tests)
  unit/          # Unit tests for isolated functions
  integration/   # Integration tests per feature area
```

### Mobile state management

Each domain has a Zustand store in `src/store/`. Pattern:

```
Screen component
  → calls store action (e.g., authStore.login)
  → store action calls service (e.g., services/auth.ts)
  → service makes axios call via services/api.ts (adds Bearer token automatically)
  → store updates state → component re-renders
```

Key stores: `authStore` (session + role), `restaurantStore` (discovery + caching), `aiRecommendationStore` (SSE streaming state), `themeStore` (dark/light).

`src/config.ts` has `MOCK_MODE` toggle and `API_URL`. In dev, API_URL points to local backend or Railway.

### Mobile screen structure

Bottom tab navigator → 5 tabs (Home, Map, Recommendations, Social, Profile). Stack navigators nested per tab. Deep links via `neareat://` scheme for email verification and password reset.

Three distinct screen sets loaded conditionally by role:
- Regular user: discovery, favorites, collections, AI recommendations, route recommendations, social
- Restaurant owner: `RestaurantDashboardScreen`, analytics, reservation management
- Admin: `AdminScreen` with user/restaurant/log management

### Database models (key relations)

- `User` → `Review`, `Favorite`, `Collection`, `FriendRequest`, `AiRecommendationLog`, `RecommendationFeedback`, `Message`, `Reservation`, `UserLog`, `ActivityEvent`, `FeedbackPreference`
- `Restaurant` (Google Places data) is not stored in DB — only `placeId` as foreign key in user-generated data
- `Subscription` controls premium tier (free: 3 AI recs/day, premium: unlimited)
- `StarEvent` + `UserReward` implement gamification (star accumulation → rewards)
- `ActivityEvent` (userId, type REVIEW|FAVORITE|RESERVATION|RECOMMENDATION, placeId, metadata) feeds the social activity feed (`GET /api/social/feed`); written fire-and-forget via `logService.logActivity`
- `FeedbackPreference` (per-user liked/disliked cuisine types) is produced by the weekly feedback aggregate cron and injected into the AI prompt

---

## Key conventions

- **Responses in Turkish** — all user-facing text, error messages, and comments in source code should be Turkish. Commit messages and code identifiers stay English.
- **Backend tests** mock Firebase, Resend, and Anthropic in `tests/setup.js` — don't call real external APIs in tests.
- **Prisma migrations** are committed and applied automatically on `npm start`. Never edit migration files after they've been applied.
- **`seed-social-test.js`** uses `neareat-test2.com` email domain (vs `neareat-test.com` for `seed-users.js`) to avoid unique constraint conflicts; run with `npx prisma db seed --script prisma/seed-social-test.js`.
- **Android emulator:** Use `Pixel_7_Standard` (not `Pixel_7` which has 16KB page size incompatibility).
- **Production URL:** `https://railway-up-production-6cdc.up.railway.app` — health check at `/health`.
