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
requestId → helmet/CORS → compression(gzip) → morgan → rate-limit → body-parse → sanitize
  → routes → auth middleware (JWT or Firebase) → roles check → controller
  → service layer → Prisma/Redis/external APIs → errorHandler
```

- **Response compression (S16-1):** `compression` (gzip) middleware runs after helmet/CORS, threshold 1KB. SSE streams (`/api/recommendations/*`, `text/event-stream`) and `x-no-compression` requests are exempt (gzip buffering would delay keepalive pings) — config + pure filter in `middleware/compressionConfig.js`. Server keep-alive tuned (`keepAliveTimeout` 61s < `headersTimeout` 65s) to avoid proxy 502s.
- **Auth:** Dual strategy — `email + bcrypt + JWT` OR `Firebase Google OAuth`. Both produce the same JWT; `middleware/auth.js` validates it on protected routes.
- **Rate limiting:** `authRateLimit` (20 req/15 min) on auth routes; `userRateLimit` (120 req/min, keyed by userId post-auth) on API routes. Expensive Anthropic endpoints add `aiRateLimit` (Redis, `AI_RATE_LIMIT_PER_MIN`) — and (S14-B5) when Redis is unavailable it is **fail-closed**: a low in-memory fallback (`AI_RATE_LIMIT_FALLBACK_PER_MIN`, default 3) caps spend instead of failing open.
- **Caching:** Redis caches Google Places nearby queries (keys include lat/lng/radius/type). Also caches premium friend social signals (`social-signals:{userId}`, 15 min) to avoid recomputing on every AI call.
- **AI recommendations:** `services/recommendationService.js` calls Anthropic Claude via SSE streaming. `recommendationController.js` forwards the stream to the client with 15s keepalive pings to avoid Railway proxy timeouts.
- **AI cost control (S16-3):** free tier = Haiku 1/day; **premium = Sonnet, capped at `PREMIUM_AI_DAILY_CAP`/day (default 30)** — an internal cost/abuse brake, not exposed as `remainingToday` (premium stays `null`); over-cap returns `429 { error: 'AI_DAILY_LIMIT' }`. A **short-TTL response cache** (`rec-cache:{userId}:{lat2}:{lng2}`, `AI_REC_CACHE_TTL` 120s) replays the previous recommendation for context-free repeat requests (no `sessionId`/`refinement`) on both the JSON and SSE endpoints — checked *before* the daily gate so a user who spent their quota can still re-view within TTL at zero Claude cost (cards collected during streaming, replayed as `card`/`note`/`done` events with `cached:true`). Every Claude call's estimated USD (`summarizeUsage`) is fed to the metrics registry via `recordExternalCall('anthropic', …)` in `logUsage` (feeds S16-2 `aiDailyUsd` alarm). Applies to dinner-tonight (JSON+stream) and route-tonight.
- **Conversational refinement:** The streaming endpoint accepts `sessionId` + `refinement` ("daha ucuz/yakın/sessiz"). Session context (previously-suggested placeIds + refinement history) is kept in Redis (`rec-session:{id}`, 30 min) so previously-suggested places are excluded on follow-ups. See `services/recommendationSession.js`.
- **Feedback loop:** A weekly cron (`jobs/feedbackAggregator.js`) aggregates `RecommendationFeedback.placeTypes` into per-user liked/disliked cuisine types (`FeedbackPreference`), injected into the AI system prompt as `cuisinePreferences`.
- **Reservation escalation:** Hourly cron in `jobs/reservationReminders.js` finds `PENDING` reservations older than 24h (`pendingReminderSentAt IS NULL`), notifies the restaurant owner + user (`RESERVATION_PENDING_REMINDER`), and stamps `pendingReminderSentAt` for idempotency.
- **Restaurant B2B (`restaurant-account` routes):** `POST /campaign` sends an `INSTANT_DISCOUNT` push to favoriters/past-reservers (max 1/day via `RestaurantProfile.lastCampaignAt`). `GET /analytics` returns reservation trend / busiest hours / status breakdown / rating distribution (pure core in `utils/restaurantAnalytics.js`). `GET /report` turns that analytics into a short Turkish business summary via `services/businessReport.js` (claude-haiku-4-5, graceful fallback to a templated summary).
- **Friend suggestions:** Nightly cron at 03:00 Europe/Istanbul (`jobs/friendSuggestions.js`) precomputes compatibility-scored friend suggestions for all users and writes them to Redis (`friend-suggestions:{userId}`, 26h TTL). Pure scoring core in `services/friendSuggestionService.js` weighs same city/country (country derived from city via `utils/cityCountry.js`), shared favorites/collections/recommendations/reservations/poll places, common cuisines + AI-feedback liked types, and similar AI usage level. `GET /social/friend-suggestions` reads the cache (on-demand compute on miss). Admin can re-run the job via `POST /admin/jobs/friend-suggestions/run` (button in admin dashboard Stats tab). **Scale-safe batch (S16-5):** `computeAllSuggestions` loads the shared candidate signals **once** (≤`CANDIDATE_POOL_LIMIT` 500), then processes viewers in **chunks** of `FRIEND_JOB_CHUNK` (default 1000) — per chunk it loads only that chunk's viewer signals + adjacency, scores, and writes them with a **single Redis pipeline** (`cacheSetMany`), releasing the maps between chunks. This bounds peak memory (no all-10k-users-in-memory) and replaces 10k sequential `cacheSet` round-trips with one pipeline per chunk; per-viewer output is identical to the old all-at-once path.
- **Discovery search (`/api/places/search`):** Free-text / name-based search via Google Places Text Search with optional 25 km location bias. Cached in Redis (`placesText:{q}:{lat3}:{lng3}`, 30 min). Shares `passesQualityFilter` (rating + name exclusion) with `/restaurants/nearby` so bakeries/markets/pharmacies/etc. don't slip through. Both endpoints accept `?cuisineTag=Tag1,Tag2` for server-side filtering against the tags derived in `utils/cuisineTags.js` (13 tags like Pizza/Kebap/Sushi from `types` + name keywords). Both also ship `minutesUntilClose` and `isNewlyOpened` freshness signals via `utils/freshnessTags.js` (override hours preferred, Google `periods` fallback; review-count proxy for newness).
- **Personalized discovery (S17-#366):** `GET /api/places/personalized?lat&lng` (auth) builds a "Senin İçin" Keşfet from the user's behavior. Pure, testable core in `services/personalizationService.js` — `buildTasteProfile(signals)` derives cuisine-tag weights + tried/high-rated/frequent placeId sets; `scorePlace(place, profile)` returns `{ score, reasons[] }` (cuisine match + favorite-cuisine/likedType bonus + frequent-place bonus − recently-tried penalty + quality/proximity); `rankForYou` sorts. `discoveryController.js` gathers signals (favorites, reviews≥4, reservations, sent recommendations, check-ins, diary, `User.favoriteCuisines`, `FeedbackPreference.likedTypes`) **once in parallel**, reuses the nearby pipeline via the extracted `restaurantController.buildNearbyResults(...)` (behavior identical to `/restaurants/nearby`), and returns `{ tasteProfile.topCuisines, recentlyViewed, forYou (reason-tagged), revisit }`. **Recently-viewed:** new `PlaceView` model (`@@unique([userId, placeId])`, denormalized place fields → rail renders with no extra Google call) — `POST /api/places/view` upserts on detail open (fire-and-forget), `GET /api/places/recently-viewed` returns last 10. Signal-less users get empty sections (200) so the mobile falls back to the standard nearby list. Mobile: `services/discovery.ts` + pure `utils/personalization.ts` (`isPersonalizationActive`/`shouldShowRails`/`mergeForYou`) drive HomeScreen rails + reason chips on `RestaurantCard` (`reasonTag` prop / `restaurant.reasons[0]`).
- **Nearby list performance (S15-P1):** `/restaurants/nearby` (`type=all`) fetches 5 Google Places types in parallel but each call is now **single-page** — the `next_page_token` pagination (2× mandatory 2s waits) was removed. The list is capped at `LIST_LIMIT=60` and 5 types × ~20 first-page results dedup well past that, so the extra pages weren't worth the ~4-5s cold-load cost. Cache key bumped `nearby3:`→`nearby4:` (in `services/googlePlaces.getNearbyRestaurants`) to avoid clashing with old 3-page data. AI/meal-group flows use the separate `getNearbyRestaurantsFast` (already single-page, distinct `nearbyFast:` cache). **Google cost optimization (S16-4):** `type=all` now fetches **3 types, not 5** — `NEARBY_ALL_TYPES` env (default `restaurant,cafe,meal_takeaway`); `bakery` was dropped (it's already excluded by the `firin/bakery` name filter → wasted spend) and `meal_delivery` (heavy `restaurant` overlap), cutting Google calls ~40% while preserving coverage. Nearby cache default TTL widened 1h→2h (`REDIS_NEARBY_TTL`) and the tile precision is env-tunable (`NEARBY_TILE_DECIMALS`, default 3 = ~110m); freshness signals stay fresh (recomputed per-request). Every real (cache-miss) Google call feeds `recordExternalCall('google', cost)` per-SKU (`GOOGLE_COST` nearby/text/details/directions) → S16-2 `googleDailyUsd` alarm. **List thumbnails (S15-P3):** the list row `photoUrl` requests a `maxwidth=200` Google photo (`getPhotoUrl(ref, LIST_THUMB_WIDTH)` in `mapPlaceToResultRow`) instead of 800px — the card slot is only 104px, so this cuts ~85% of the image bytes; the detail screen keeps full-size (800px) photos.
- **Reviews pagination (S14-B6):** `GET /api/reviews/:placeId` supports cursor pagination — `?limit=&cursor=` returns `{ reviews, hasMore, nextCursor }` (Prisma `cursor`+`skip`, ordered by `createdAt desc`). With NO pagination params it stays backward-compatible and returns a plain array (capped at the default limit). Mobile `fetchAppReviews` passes `limit` and tolerates both shapes.
- **Search history (`/api/search-history`):** `SearchHistory(userId, query, type)` model. `/places/search` fires-and-forgets a row for authenticated users. `promptBuilder.buildUserProfileSummary` injects the last 7 days' top-5 keywords into the AI system prompt as `recentSearches`. KVKK: users can clear all (`DELETE /api/search-history`) or one (`DELETE /:id` with ownership check).
- **Premium/free tier enforcement:** `utils/premiumCheck.isPremiumUser(userId)` (active/trial subscription OR `ALWAYS_PREMIUM_EMAILS` allowlist) gates free limits across controllers; all gates return `403 { code: 'PREMIUM_REQUIRED' }`. Free limits — AI rec **1/day**, restaurant recommendation **1/day**, favorites **5**, collections **1**, reservations **lifetime 1**; restaurant menu + product photos hidden (`hasProductPhotos` flag). Restaurant free tier can't enable reservations, instant discount, campaign, or upload PRODUCT photos. Mobile catches the 403 and routes to a role-aware `PaywallScreen` (`utils/premiumGate.ts`).
- **IAP (Google Play subscriptions):** `POST /api/subscriptions/verify/android` validates a `purchaseToken` via `androidpublisher.purchases.subscriptions.get` (env `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` + `GOOGLE_PLAY_PACKAGE_NAME`; 503 if unconfigured). **Role-based product IDs**: `user_premium` (79,90 ₺/mo) and `restaurant_premium` (699,90 ₺/mo) — mobile SKUs and backend must match. RTDN: `POST /webhooks/google-play` (Pub/Sub push, always 200) updates subscription status; `GET /webhooks/google-play/last` is a non-sensitive diagnostic of the last received notification (admin-only since S13-2). **Purchase ledger (S14-B4):** every verify (android/appstore) and RTDN event is appended to the `PurchaseEvent` table (`services/purchaseLedger.js`, best-effort, purchase token stored HMAC-hashed) — for abuse detection / accounting / support. Statuses: `verified` / `reuse_rejected` / `account_mismatch` / `blocked` (appstore) / `refreshed`·`cancelled`·`expired` (RTDN).
- **Transactional email (Resend):** `services/emailService.js` sends Eatlas-branded verification / password-reset / welcome emails. Sender domain `eatlastr.com` (env `EMAIL_FROM`, `RESEND_API_KEY`, `APP_BASE_URL`, `TOKEN_HASH_SECRET`). `GET /verify-email` and `/reset-password` return a branded landing page (`utils/appLinkPage.js`) that opens the `neareat://` deep link with a Play Store fallback (email clients block raw custom-scheme redirects). Tokens are HMAC-hashed in the DB (`utils/tokenHash.js`). **Per-address send throttle (S14-B1):** `forgotPassword`/`resendVerification` are rate-limited per email address (Redis, env `EMAIL_SEND_MAX_PER_HOUR`, default 3) on top of the IP `authLimiter`, to block mail-bombing / Resend quota burn; a throttled password-reset returns the same generic response (no enumeration leak), resend returns 429. Fail-open if Redis is down.

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

> **Typed API layer (S14-M2):** service functions are typed against shared interfaces in `src/types` (e.g. `PublicUser`, `RawRecommendation`) rather than `any`. When adding/consuming an endpoint, add/extend a type there and annotate the service return; keep `tsc --noEmit` clean.
>
> **Analytics (S14-M5):** funnel events go through `trackEvent(name, props)` (`services/analytics.ts`) using the `ANALYTICS_EVENTS` names. Provider-agnostic: a real sink is attached via `setAnalyticsSink` (none by default → full no-op, so dev/test/SDK-less builds are unaffected). PII keys (email/phone/token/…) are stripped before send. Instrumented: paywall shown, restaurant detail open, reservation started/completed, AI recommendation requested.
>
> **List performance (S14-M4):** spread the shared `listPerf` props (`theme/listPerf.ts` — `removeClippedSubviews` on Android, `initialNumToRender`/`maxToRenderPerBatch`/`windowSize`) into heavy `FlatList`s, keep `keyExtractor` stable, and `React.memo` row cards (e.g. `RestaurantCard`). Applied to Favorites/Conversation/Collections.
>
> **Crash reporting (S14-M3):** `services/sentry.ts` wraps `@sentry/react-native`, env-gated by `app.json → extra.sentryDsn` (no-op when empty, so dev/test/DSN-less builds are unaffected). `initSentry()` runs at App startup, `wrapWithSentry(App)` adds the Sentry error boundary, and `ErrorBoundary.componentDidCatch` forwards to `captureException`; password/token fields are scrubbed in `beforeSend`. To activate: set `sentryDsn` and rebuild the native app (the `@sentry/react-native` Expo config plugin is already in `app.json`).

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

**Micro-polish (S17-#368):** `components/PressableScale` (RN `Animated` scale + haptic on press — matches the existing `Skeleton`/`Toast` Animated convention, no reanimated) wraps tappable cards/CTAs (`RestaurantCard`, Home AI CTAs, rail mini-cards); `components/FadeInImage` is a drop-in `Image` that fades in on load (used in `RestaurantCard`, rails, map preview). **Optimistic favorite:** pure `utils/optimisticFavorite.runOptimisticFavoriteToggle({ placeId, currentlyFavorited, inFlight, applyOptimistic, persist, onError })` — instant UI update, revert + `onError` on failure, double-tap guard via an `inFlight` Set ref. Used by `RestaurantDetailScreen` (keeps the `PREMIUM_REQUIRED` → Paywall path in `onError`) and the map preview card. Prefer this util for any new favorite toggle.

**Keşfet (Home):** no category tabs (cuisine-tag chips only); free-text search; an "Açık" open-now filter (label stays "Açık", state shown by the radio dot). Favorited places show a heart badge on the card. A dismissable `EmailVerificationBanner` (S14-M1) shows under the header for unverified email accounts (`shouldShowVerifyBanner` in `utils/emailVerification.ts`; Google users never see it) with a "resend verification" action — this is the UX that lets backend `ENFORCE_EMAIL_VERIFICATION` be turned on. **Personalization (S17-#366):** in the default view (no search, no cuisine filter) the list shows horizontal rails ("Son Baktıkların", "Tekrar gitmek ister misin?") as `ListHeaderComponent` and re-orders the nearby list by personal score (`forYou` first via `mergeForYou`); cards carry a reason chip. Falls back to the plain nearby list when personalization data is absent.

> **Stale-while-revalidate (S15-P2):** `restaurantStore` now persists the last nearby `restaurants` list + `lastCoords` + `lastFetchedAt` (in addition to filters), so a reopen paints the previous list **instantly** instead of skeleton → wait. On mount, HomeScreen waits for persist hydration (`_hasHydrated`, set via `onRehydrateStorage`), seeds `coordsRef`/`lastFetchRef` from the persisted meta (skips GPS), then refreshes in the background; the new list swaps in silently. Pure decision helpers live in `utils/listCache.ts` (`shouldShowSkeleton` — only when hydrated+loading+empty, so cached users never see a skeleton flash; `isListStale`; `isCachedListUsable`). `searchResults`/`searchQuery` stay runtime-only (not persisted).

> **Map view clustering (S17-#367):** `MapViewScreen` clusters overlapping pins so dense areas stay readable. Pure, jest-tested core in `utils/mapClustering.ts` — `clusterPoints(points, region, divisions)` grids the visible region (delta/`GRID_DIVISIONS`) so zoom-in dissolves clusters into singles; `regionForCluster(items)` returns the bbox region for tap-to-zoom. Cluster markers show a count and zoom in on tap; single markers open a **bottom preview card** (photo/name/rating/distance/open + "Detayı Gör" + quick-favorite) instead of the cramped `Callout`. The quick-favorite uses `services/favorites.addFavoriteFromRestaurant` (lighter than detail's `addFavorite`, no phone) with an optimistic `favoriteStore` toggle + revert on error. Markers use `tracksViewChanges={false}` for perf.

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
- **Input validation (S14-B2):** prefer the `validate(schema)` middleware (`middleware/validate.js`) with zod schemas in `validation/schemas.js` over ad-hoc `typeof`/length checks in controllers. It returns `400 { error, details }` (error = first issue's message, Turkish) and writes the parsed/coerced value back to `req.body`. Migrated so far: `register`, `login/email`, `POST /reviews`; migrate more endpoints incrementally.
- **Observability (S14-B3):** `services/sentry.js` forwards security events (`securityLogger`) and 5xx errors (`errorHandler`) to Sentry. Env-gated by `SENTRY_DSN` (no-op when unset, so dev/test are unaffected); password/token fields are scrubbed before sending. Route security-relevant signals through `logSecurityEvent` so they reach Sentry automatically.
- **Performance metrics (S16-2):** `services/metrics.js` is an in-memory, process-local registry — request p50/p95/p99 + status buckets (via `middleware/metrics.js` on `res 'finish'`, mounted right after `requestId`), Redis hit/miss (instrumented in `redis.cacheGet`), event-loop lag (`perf_hooks.monitorEventLoopDelay`), and per-provider external-API call+cost counters (`recordExternalCall`, fed by S16-3 Anthropic / S16-4 Google with daily reset). Bounded memory (1000-sample ring window). `GET /api/admin/metrics` (admin-only) returns the snapshot + live DB active-connection count (`pg_stat_activity`, graceful-null) + current alarm breaches. A periodic `evaluateAlarms` sweep (`METRICS_ALARM_INTERVAL_MS`, default 60s, skipped in tests, `.unref()`) emits `EVENTS.METRICS_ALARM` via `logSecurityEvent`→Sentry when thresholds (`ALARM_ERROR_RATE` .02, `ALARM_EVENT_LOOP_LAG_MS` 200, `ALARM_AI_DAILY_USD` 50, `ALARM_GOOGLE_DAILY_USD` 30) are exceeded (error-rate alarm needs ≥50 samples to avoid noise). Metrics are per-replica (S16-8): the endpoint shows whichever replica served it.
- **Backend tests** mock Firebase, Resend, and Anthropic in `tests/setup.js` — don't call real external APIs in tests.
- **Load tests (S16-9):** k6 scripts in `neareat-backend/load-tests/k6/` (`browse`/`login`/`ai`) validate capacity against the 10k target. **Staging only** — `load-tests/lib/guard.js` requires `BASE_URL` and refuses production hosts (override `ALLOW_PRODUCTION=true`); the guard is pure JS and jest-tested. Correlate runs with `GET /api/admin/metrics` (S16-2). The `ai` scenario costs Anthropic — keep VUs low or mock. See `load-tests/README.md`.
- **Cron/job testing (S14-B7):** extract a job's pure decision logic into exported helpers (e.g., `smartNotifications` exports `closingSoonDiff`/`isInClosingWindow`/`selectUnvotedMembers`/`getTurkeyNow`) and unit-test those + idempotency (mock prisma/redis/notificationService) rather than the cron wiring. Covered cores: `smartNotifications`, `reservationReminders`, `friendSuggestionService`.
- **Replica-safe crons (S16-6):** all in-process `node-cron` schedules are wrapped in `withCronLock(jobName, fn)` (`services/cronLock.js`) so that with 2+ backend replicas (S16-8) each tick runs on **only one** replica — it does `SET cron-lock:{jobName} {instanceId} NX PX {ttl}` (default 30 min, `CRON_LOCK_TTL_MS`); the acquirer runs, others skip. The lock is **not released** (TTL-expires before the next tick) so the same tick isn't re-run. **Redis-down → fail-open** (runs, single-instance assumption); per-job idempotency (e.g. `pendingReminderSentAt`) is the second line of defense. Admin manual triggers call the run-fn directly (no lock), so they always execute. When adding a new cron, wrap it in `withCronLock`.
- **Mobile tests** (`jest.setup.js`) globally mock native modules (`react-native-safe-area-context`, `@react-native-masked-view/masked-view`, `expo-linear-gradient`, `@expo/vector-icons`, `expo-haptics`, AsyncStorage). When a new component pulls in a native module, add its mock here or the suite breaks. Prefer extracting pure logic into `utils/` with a focused unit test over mounting heavy screens.
- **Prisma migrations** are committed and applied automatically on `npm start`. Never edit migration files after they've been applied. **DB pooling / PgBouncer (S16-7):** the schema has `url = env("DATABASE_URL")` (runtime, pooler-capable) + `directUrl = env("DIRECT_URL")` (migrations, must hit Postgres directly — pooler transaction-mode can't run some DDL). Start is `node prisma/deploy.js && node src/app.js`: `prisma/deploy.js` defaults `DIRECT_URL` to `DATABASE_URL` when unset (so behavior is unchanged until PgBouncer is wired) then runs `migrate resolve`(best-effort)+`migrate deploy`. For 10k horizontal scaling, set `DATABASE_URL`=pooler `?pgbouncer=true&connection_limit=N` and `DIRECT_URL`=direct; see [docs/DB_POOL_PGBOUNCER.md](neareat-backend/docs/DB_POOL_PGBOUNCER.md) for the Railway steps + `connection_limit` formula. Live pool gauge: `GET /api/admin/metrics → db.activeConnections`.
- **`seed-social-test.js`** uses `neareat-test2.com` email domain (vs `neareat-test.com` for `seed-users.js`) to avoid unique constraint conflicts; run with `npx prisma db seed --script prisma/seed-social-test.js`.
- **Android emulator:** Use `Pixel_7_Standard` (not `Pixel_7` which has 16KB page size incompatibility).
- **Production URL:** `https://railway-up-production-6cdc.up.railway.app` — health check at `/health`.
- **Horizontal scaling (S16-8):** the backend is replica-safe for 2+ Railway replicas (prereqs: S16-6 cron leader-lock, S16-7 DB pool). Graceful shutdown sets `utils/readiness.setShuttingDown(true)` on SIGTERM/SIGINT so `/health` returns **503 `shutting_down`** (LB drains away before `server.close()` finishes; 10s force-exit). `railway.toml` sets `healthcheckPath=/health` for zero-downtime rolling deploys. Stateless except deliberately per-replica `metrics` (S16-2) and the `aiRateLimit` in-memory fallback (only when Redis is down). To scale: set replicas=2 in Railway + harden Redis (`allkeys-lru`, enough memory/HA) — see [docs/HORIZONTAL_SCALING.md](neareat-backend/docs/HORIZONTAL_SCALING.md).
