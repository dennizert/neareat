# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NearEat** — mobile-first restaurant discovery platform. Monorepo with two packages:
- `neareat-backend/` — Node.js + Express + Prisma + PostgreSQL + Redis, deployed on Railway
- `neareat-mobile/` — React Native (Expo ~52 bare workflow) + Zustand, Android APK distributed manually

Three user roles: regular user, restaurant owner, admin. Turkish-language UI.

> **Branding:** the product is branded **Eatlas** in the UI (`app.json` name `Eatlas`, Android package `com.eatlas.mobile`, gradient `EatlasLogo` in the header). The repo, directories, and slug stay `neareat`. Keep code identifiers as `NearEat`/`neareat`; only user-facing branding is Eatlas.

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
- **Friend suggestions:** Nightly cron at 03:00 Europe/Istanbul (`jobs/friendSuggestions.js`) precomputes compatibility-scored friend suggestions for all users and writes them to Redis (`friend-suggestions:{userId}`, 26h TTL). Pure scoring core in `services/friendSuggestionService.js` weighs same city/country (country derived from city via `utils/cityCountry.js`), shared favorites/collections/recommendations/reservations/poll places, common cuisines + AI-feedback liked types, and similar AI usage level. `GET /social/friend-suggestions` reads the cache (on-demand compute on miss). Admin can re-run the job via `POST /admin/jobs/friend-suggestions/run` (button in admin dashboard Stats tab).
- **Discovery search (`/api/places/search`):** Free-text / name-based search via Google Places Text Search with optional 25 km location bias. Cached in Redis (`placesText:{q}:{lat3}:{lng3}`, 30 min). Shares `passesQualityFilter` (rating + name exclusion) with `/restaurants/nearby` so bakeries/markets/pharmacies/etc. don't slip through. Both endpoints accept `?cuisineTag=Tag1,Tag2` for server-side filtering against the tags derived in `utils/cuisineTags.js` (13 tags like Pizza/Kebap/Sushi from `types` + name keywords). Both also ship `minutesUntilClose` and `isNewlyOpened` freshness signals via `utils/freshnessTags.js` (override hours preferred, Google `periods` fallback; review-count proxy for newness).
- **Search history (`/api/search-history`):** `SearchHistory(userId, query, type)` model. `/places/search` fires-and-forgets a row for authenticated users. `promptBuilder.buildUserProfileSummary` injects the last 7 days' top-5 keywords into the AI system prompt as `recentSearches`. KVKK: users can clear all (`DELETE /api/search-history`) or one (`DELETE /:id` with ownership check).
- **Premium/free tier enforcement:** `utils/premiumCheck.isPremiumUser(userId)` (active/trial subscription OR `ALWAYS_PREMIUM_EMAILS` allowlist) gates free limits across controllers; all gates return `403 { code: 'PREMIUM_REQUIRED' }`. Free limits — AI rec **1/day**, restaurant recommendation **1/day**, favorites **5**, collections **1**, reservations **lifetime 1**; restaurant menu + product photos hidden (`hasProductPhotos` flag). Restaurant free tier can't enable reservations, instant discount, campaign, or upload PRODUCT photos. Mobile catches the 403 and routes to a role-aware `PaywallScreen` (`utils/premiumGate.ts`).
- **IAP (Google Play subscriptions):** `POST /api/subscriptions/verify/android` validates a `purchaseToken` via `androidpublisher.purchases.subscriptions.get` (env `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` + `GOOGLE_PLAY_PACKAGE_NAME`; 503 if unconfigured). **Role-based product IDs**: `user_premium` (79,90 ₺/mo) and `restaurant_premium` (699,90 ₺/mo) — mobile SKUs and backend must match. RTDN: `POST /webhooks/google-play` (Pub/Sub push, always 200) updates subscription status; `GET /webhooks/google-play/last` is a non-sensitive diagnostic of the last received notification.
- **Transactional email (Resend):** `services/emailService.js` sends Eatlas-branded verification / password-reset / welcome emails. Sender domain `eatlastr.com` (env `EMAIL_FROM`, `RESEND_API_KEY`, `APP_BASE_URL`, `TOKEN_HASH_SECRET`). `GET /verify-email` and `/reset-password` return a branded landing page (`utils/appLinkPage.js`) that opens the `neareat://` deep link with a Play Store fallback (email clients block raw custom-scheme redirects). Tokens are HMAC-hashed in the DB (`utils/tokenHash.js`).

### Backend directory layout

```
src/
  controllers/   # Business logic (one file per domain)
  routes/        # Express routers (map HTTP → controllers)
  middleware/    # auth, roles, errorHandler, sanitize, securityLogger, userRateLimit, requestId
  services/      # External integrations: googlePlaces, firebase, redis, resend (email), anthropic, googleapis (Play IAP), s3
  jobs/          # Cron: reservationReminders, smartNotifications, feedbackAggregator, friendSuggestions
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

Bottom tab navigator (regular user) → 5 tabs: **Keşfet** (Home), **Favoriler**, **Listeler** (Collections), **Mesajlar**, **Profil**. Restaurant/admin roles render their own root stacks (no bottom tabs). Deep links via `neareat://` scheme for email verification and password reset; in-app notification taps deep-link via `utils/notificationTarget.ts`.

Three distinct screen sets loaded conditionally by role:
- Regular user: discovery, favorites, collections, AI recommendations, route recommendations, social
- Restaurant owner: `RestaurantDashboardScreen`, analytics, reservation management
- Admin: `AdminScreen` with user/restaurant/log management

**Shared header (`components/AppHeader.tsx`):** all three roles use one uniform light header — left `EatlasLogo`, center role-specific (Liste/Harita toggle · restaurant display name · admin name + "Sistem Yöneticisi"), right actions (notification bell / logout / logs). `EatlasLogo` renders the single word "Eatlas" with a soft left-to-right coral→amber gradient (`expo-linear-gradient` + `@react-native-masked-view/masked-view`).

**Reusable UI (S11):** `AppIcon` (central `theme/icons.ts` semantic map), `Toast` + `useToast`, `Skeleton`/`SkeletonCard`, `EmptyState`, `ErrorState`, `utils/haptics`. Prefer these over ad-hoc `Alert`/spinners/emoji icons.

**Keşfet (Home):** no category tabs (cuisine-tag chips only); free-text search; an "Açık" open-now filter (label stays "Açık", state shown by the radio dot). Favorited places show a heart badge on the card.

**Restaurant detail (`RestaurantDetailScreen`):** dual rating — Google + **Eatlas** (in-app review average + count, computed client-side in `utils/appRating.ts`, no backend); collapsible working hours; one compact row of round action icons (Konum=teal, Öner=coral, rest neutral) + an "Ekle" (+) menu → Favorilere/Günlüğe/Listeye Ekle; a colored Check-in pill by the name; a "Favorilerinde" tag when favorited. **Rating is given only via the review form** (the old standalone quick-rating widget was removed).

**Notifications:** `utils/notificationTarget.ts` maps a notification `type` + `data` to a deep-link target (reservations, places, meal groups, friends, rewards, `WEEKLY_DIGEST` → `WeeklySummaryScreen`); each row also has an inline "mark as read" button that marks read without navigating.

### Database models (key relations)

- `User` → `Review`, `Favorite`, `Collection`, `FriendRequest`, `AiRecommendationLog`, `RecommendationFeedback`, `Message`, `Reservation`, `UserLog`, `ActivityEvent`, `FeedbackPreference`
- `Restaurant` (Google Places data) is not stored in DB — only `placeId` as foreign key in user-generated data
- `Subscription` controls premium tier (free: 1 AI rec/day + other free limits, premium: unlimited). See the premium/free tier enforcement bullet above and `utils/premiumCheck.js`
- `StarEvent` + `UserReward` implement gamification (star accumulation → rewards)
- `ActivityEvent` (userId, type REVIEW|FAVORITE|RESERVATION|RECOMMENDATION, placeId, metadata) feeds the social activity feed (`GET /api/social/feed`); written fire-and-forget via `logService.logActivity`
- `FeedbackPreference` (per-user liked/disliked cuisine types) is produced by the weekly feedback aggregate cron and injected into the AI prompt

---

## Key conventions

- **Responses in Turkish** — all user-facing text, error messages, and comments in source code should be Turkish. Commit messages and code identifiers stay English.
- **Backend tests** mock Firebase, Resend, and Anthropic in `tests/setup.js` — don't call real external APIs in tests.
- **Mobile tests** (`jest.setup.js`) globally mock native modules (`react-native-safe-area-context`, `@react-native-masked-view/masked-view`, `expo-linear-gradient`, `@expo/vector-icons`, `expo-haptics`, AsyncStorage). When a new component pulls in a native module, add its mock here or the suite breaks. Prefer extracting pure logic into `utils/` with a focused unit test over mounting heavy screens.
- **Prisma migrations** are committed and applied automatically on `npm start`. Never edit migration files after they've been applied.
- **`seed-social-test.js`** uses `neareat-test2.com` email domain (vs `neareat-test.com` for `seed-users.js`) to avoid unique constraint conflicts; run with `npx prisma db seed --script prisma/seed-social-test.js`.
- **Android emulator:** Use `Pixel_7_Standard` (not `Pixel_7` which has 16KB page size incompatibility).
- **Production URL:** `https://railway-up-production-6cdc.up.railway.app` — health check at `/health`.
