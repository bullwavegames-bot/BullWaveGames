# Bullwave Games frontend design

Status: implementation specification, September 9, 2026. This document describes the target frontend architecture; it does not assert that integration, deployment, or performance testing is complete.

## Decisions

Keep React 19, Vite, React Router, Framer Motion, Supabase Auth, and the existing game engines. Restructure the application around feature modules, typed backend communication, server-owned account data, lazy-loaded routes, and explicit loading and error states.

Supabase owns authentication sessions, passwords, email confirmation, and recovery. The Fastify API owns profiles used by the application, catalog, memberships, billing, scores, saves, achievements, cosmetics, social data, support, and administration. The browser stores only device preferences, guest identity, unfinished local game boards, and explicitly unranked practice data.

## Target folder structure

```text
src/
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   ├── providers.tsx
│   ├── query-client.ts
│   ├── error-boundary.tsx
│   └── guards/
│       ├── RequireAuth.tsx
│       ├── RequireOnboarded.tsx
│       └── RequireAdmin.tsx
│
├── api/
│   ├── client.ts
│   ├── errors.ts
│   ├── request-id.ts
│   ├── websocket.ts
│   └── contracts/
│       ├── common.ts
│       ├── account.ts
│       ├── catalog.ts
│       ├── billing.ts
│       ├── play.ts
│       ├── rooms.ts
│       ├── social.ts
│       └── admin.ts
│
├── features/
│   ├── auth/
│   │   ├── auth-provider.tsx
│   │   ├── auth-service.ts
│   │   ├── auth-hooks.ts
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── VerifyEmailPage.tsx
│   │   ├── ResetPasswordPage.tsx
│   │   └── WelcomePage.tsx
│   ├── account/
│   │   ├── account-api.ts
│   │   ├── account-queries.ts
│   │   ├── ProfilePage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── BillingPage.tsx
│   ├── catalog/
│   │   ├── catalog-api.ts
│   │   ├── catalog-queries.ts
│   │   ├── CatalogPage.tsx
│   │   ├── GameDetailPage.tsx
│   │   └── components/
│   ├── membership/
│   │   ├── membership-api.ts
│   │   ├── membership-queries.ts
│   │   ├── entitlement.ts
│   │   └── MembershipPage.tsx
│   ├── billing/
│   │   ├── billing-api.ts
│   │   ├── billing-mutations.ts
│   │   ├── checkout-session.ts
│   │   ├── CheckoutPage.tsx
│   │   └── PaymentReturnPage.tsx
│   ├── play/
│   │   ├── play-api.ts
│   │   ├── play-session.ts
│   │   ├── progress-queries.ts
│   │   ├── score-mutations.ts
│   │   └── GameSessionPage.tsx
│   ├── rooms/
│   │   ├── room-client.ts
│   │   ├── room-machine.ts
│   │   ├── room-types.ts
│   │   ├── use-room.ts
│   │   └── components/
│   ├── leaderboard/
│   │   ├── leaderboard-api.ts
│   │   ├── leaderboard-queries.ts
│   │   └── components/
│   ├── challenges/
│   │   ├── challenge-api.ts
│   │   ├── challenge-queries.ts
│   │   └── ChallengesPage.tsx
│   ├── social/
│   │   ├── social-api.ts
│   │   ├── social-queries.ts
│   │   └── components/
│   ├── support/
│   │   ├── support-api.ts
│   │   ├── support-mutations.ts
│   │   └── ContactPage.tsx
│   ├── admin/
│   │   ├── admin-api.ts
│   │   ├── admin-queries.ts
│   │   ├── AdminHomePage.tsx
│   │   ├── AdminMembersPage.tsx
│   │   ├── AdminGamesPage.tsx
│   │   └── AdminContentPage.tsx
│   └── content/
│       ├── LandingPage.tsx
│       ├── StoriesPage.tsx
│       ├── HelpPage.tsx
│       └── PolicyPages.tsx
│
├── games/
│   ├── registry.ts
│   ├── types.ts
│   ├── originals/
│   ├── arcade/
│   ├── cards/
│   ├── puzzles/
│   ├── quiz/
│   ├── strategy/
│   └── multiplayer/
│
├── components/
│   ├── layout/
│   ├── feedback/
│   ├── navigation/
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Dialog.tsx
│       ├── Field.tsx
│       ├── Notice.tsx
│       ├── Skeleton.tsx
│       └── Spinner.tsx
│
├── config/
│   ├── environment.ts
│   ├── product.ts
│   └── routes.ts
│
├── state/
│   ├── ui-provider.tsx
│   ├── preferences-provider.tsx
│   └── notifications-provider.tsx
│
├── lib/
│   ├── device-storage.ts
│   ├── storage-migration.ts
│   ├── accessibility.ts
│   ├── currency.ts
│   ├── date-time.ts
│   ├── idempotency.ts
│   └── telemetry.ts
│
├── styles/
│   ├── tokens.css
│   ├── reset.css
│   ├── global.css
│   ├── utilities.css
│   └── components.css
│
├── test/
│   ├── setup.ts
│   ├── factories.ts
│   ├── handlers.ts
│   └── fixtures/
│
├── main.tsx
└── vite-env.d.ts
```

Files remain private to their feature unless another feature has a real dependency on them. Public feature exports may use a small `index.ts`, but the application must avoid broad barrel files that import every game or route and defeat code splitting.

## Application layers

### App shell and routing

The app layer composes providers, declares routes, and owns route-level error handling. Preserve the existing public URLs. Lazy-load page modules and game bundles so the landing page does not download the full arcade or admin interface.

Route guards wait for authentication and account bootstrap before making a decision. They must prevent protected-content flashes. `RequireAdmin` uses the role returned by the backend rather than editable Supabase metadata or browser state.

### API and contracts

Use one typed HTTP client configured by `VITE_API_URL`. It attaches the current Supabase bearer token, includes credentials for server-issued guest cookies, adds a request ID, enforces a timeout, and normalizes API errors. On an expired session, refresh Supabase once and retry the request once.

Do not automatically retry billing, score submission, support, or admin mutations unless the request carries an idempotency identifier. Abort obsolete requests after logout or account changes.

Use a separate WebSocket client configured by `VITE_ROOMS_URL`. It obtains a short-lived room ticket, authenticates immediately after connecting, tracks room versions and action IDs, reconnects with capped exponential backoff, and resumes through the server-issued reconnect credential.

Frontend contracts must include `past_due`, `graceEnd`, integer payment amounts in paise, pagination metadata, request IDs, room versions, action IDs, and reconnect credentials. Convert API DTOs to view models at feature boundaries rather than exposing database rows to components.

### Server state and local state

Use TanStack Query for account, catalog, plans, membership, invoices, orders, progress, saves, achievements, cosmetics, leaderboards, challenges, friendships, support, and admin resources. Use stable query keys such as `account`, `catalog`, `plans`, `progress`, `leaderboard`, `billing`, and `admin`. Invalidate only the affected keys after mutations.

Keep React context for Supabase authentication and small cross-cutting UI concerns: notifications, reduced motion, sound preferences, and the introduction screen. Component state owns forms, dialogs, filters, and active game interactions.

Remove memberships, invoices, orders, ranked scores, roles, paid cosmetics, support tickets, and admin changes from `AppState` and local storage. Allow local persistence only for device preferences, anonymous guest identity, unfinished offline-compatible boards, and explicitly unranked practice results. Provide a one-time validated migration for permitted saves.

## Feature behavior

Load `/api/me` after authentication as the authoritative account bootstrap response. Refresh it after profile, membership, billing, and account mutations. Clear protected caches on logout and isolate caches by authenticated user.

Catalog and plan pages use backend data with explicit loading, empty, stale, and unavailable states. Game launch requests a server play session before ranked play. Score submission consumes that session once; the result screen distinguishes accepted, unranked, rejected, and retryable outcomes. Server saves replace local saves for signed-in users.

Checkout uses a server-created Razorpay subscription and displays pending until the backend confirms payment. The payment-return page polls the stored order with a bounded timeout and supports safe recovery after refresh. The browser never activates membership directly.

Room screens distinguish connecting, lobby, playing, reconnecting, interrupted, and ended states. A reconnect restores the complete authoritative state. Client animation may predict presentation, but the room server decides accepted actions and game results.

Support submissions and every admin mutation go through the API. Admin screens display server authorization failures and audit-related error information without revealing sensitive logs.

## Error handling and accessibility

Provide route error boundaries and feature-level recovery controls. Model initial loading, background refresh, empty data, offline state, permission errors, validation errors, rate limits, and server failures separately. Preserve last successful read-only data during a background refresh when safe.

All interactive controls remain keyboard reachable and show visible focus. Dialogs trap and restore focus. Live game and payment messages use appropriate announcements without overwhelming screen readers. Honor reduced motion throughout navigation, celebrations, and game transitions. Keep sound muted until explicit consent.

## Performance and deployment

Build the frontend as static assets and serve them through a global CDN. Cache fingerprinted assets for one year and the HTML shell with revalidation. Do not cache personalized API responses at the CDN.

Split public content, account, checkout, admin, and each large game into separate chunks. Preload only the selected game after a user shows launch intent. Compress images, specify dimensions to prevent layout movement, and avoid loading admin or multiplayer code on public pages.

Track Core Web Vitals, route errors, failed API calls, checkout failures, room reconnects, and game-loading time. Redact bearer tokens, payment payloads, emails, room credentials, and save contents from telemetry.

## Phased implementation

1. Create the application, API, contract, and provider foundations; add environment validation, typed errors, query setup, lazy routing, and route error boundaries.
2. Connect account bootstrap, onboarding, profile, settings, catalog, plans, and entitlement display.
3. Connect play sessions, score submission, saves, achievements, cosmetics, challenges, and leaderboards.
4. Replace simulated checkout with server-created subscriptions, verification, order polling, invoices, cancellation, and payment recovery.
5. Connect support and administration with server authorization, mutation feedback, and cache invalidation.
6. Add room tickets, configured WebSocket URLs, reconnect handling, resume credentials, action IDs, and connection status.
7. Remove obsolete server-owned fields from `AppState`, migrate permitted local saves, and delete prototype-only paths.
8. Complete route and game chunking, asset optimization, telemetry, accessibility validation, and production deployment configuration.

Each phase must leave the application buildable. Move existing screens into feature folders only when their data dependencies are converted, avoiding one large mechanical reorganization.

## Test and acceptance criteria

Test API parsing, error normalization, storage migration, entitlement decisions, idempotency identifiers, and room reconnection. Integration tests cover bearer-token attachment, expired-session refresh, logout cleanup, account switching, failed mutations, and cache invalidation.

Browser flows cover signup, verification, onboarding, catalog, game launch, accepted and rejected scores, cross-device saves, checkout recovery, billing, support, and admin operations. Room coverage includes create, join, simultaneous actions, duplicates, reconnect, interruption, and hidden player state. Preserve the existing game regression suite.

Verify layouts at 390, 768, 1280, and 1440 pixels. Require a production build with no TypeScript errors, no protected-content flash, and no server-owned state restored from local storage. Measure the initial bundle, individual game chunks, Core Web Vitals, API latency, and multiplayer latency from Asia, Europe, and North America.

## Assumptions

The frontend remains a React and Vite browser application. Supabase Auth remains the authentication provider, and Fastify remains authoritative for application and game data. Current visual styling, route URLs, games, and content remain available. Initial deployment uses a global static CDN with one primary multiplayer region.

The backend Supabase identity phase must be completed and verified before frontend account integration begins.
