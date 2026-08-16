# Changelog

All notable changes to Pressmark are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed

- "Mark all as read" while filtered to one source now only marks that source's articles read, instead of the whole feed across every subscription; the unread-count badge is scoped the same way
- Loading more of the feed no longer splices stale items (and a stale pagination cursor) into the list if the source/unread filter changes before the load-more request finishes

### Security

- Patched an XSS gap in article-summary sanitization by updating `dompurify` to a fixed version (GHSA-55q2-fjhq-7xh7)
- Closed four transitive vulnerabilities in frontend build tooling (`brace-expansion`, `fast-uri`, `js-yaml`, `nanoid`) via npm overrides — none of these reach the shipped bundle or run at runtime (GHSA-rgw5-rvv9-x895, GHSA-7p8r-x3mc-p8w7, GHSA-5p4m-2wfm-xmqj, GHSA-2v37-7h3g-55p8)

## [1.2.0] — Reliability, Security & Dependency Refresh — 2026-07-28

### Fixed

- `RssFetcherService` no longer stops the host on a transient error while loading the subscription list — the fetch cycle is now guarded the same way as its sibling background services
- `MarkAllAsRead` now rejects a malformed `subscription_id` instead of silently marking the caller's entire feed as read
- A broken SMTP configuration no longer turns `ForgotPassword` back into an account-existence oracle — delivery failures are logged, not surfaced
- Daily digest no longer logs the recipient's email address
- Feed entries with no `<link href>` no longer fail the whole fetch; the Open Graph image scraper no longer stops short of its read budget on a slow response
- Bookmarks page no longer shows a stale filtered result when the source filter changes mid-request
- Article page no longer keeps showing "not found" after navigating from a missing article to a valid one

### Security

- Patched a transitive vulnerability in `@modelcontextprotocol/sdk` (pulled in via shadcn tooling) by overriding `@hono/node-server` to a fixed version (GHSA-frvp-7c67-39w9)

### Changed

- Routine dependency updates across backend (NuGet), frontend (npm), Docker base images, and GitHub Actions to their latest compatible versions
- `SubscriptionServiceImpl` restructured to match the partial-class + extracted-helper pattern used by the other gRPC services

## [1.1.0] — Community, SEO & nginx — 2026-04-20

### Added

- `community_page_enabled` site setting — admins can disable the public Community page; router guard redirects visitors when off
- Dynamic page titles (`<title>`) on every route; `sitemap.xml` generated from published articles
- SEO meta and Open Graph tags; `robots.txt` served by the backend; `site_description` admin setting
- Favicon proxy endpoint — backend fetches and caches RSS source favicons to avoid CORB/CORP browser blocks
- nginx gzip compression and static-asset cache headers for production deployment
- Hardened nginx security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- Admin page split into lazy-loaded sub-components for faster initial load
- Option A / Option B deployment docs — pre-built GHCR images with version-pinning note
- Quality Gate badge in README

### Fixed

- Secure cookie flag now set based on environment, not request scheme
- Per-user `since` timestamp restored in community digest; digest job switched to `RunAsync`
- Personal feed included in daily digest; duplicate articles across digest runs prevented
- `html[lang]` attribute synced with i18n language on app init and locale switch
- HTTP images and `media-src` added to CSP so RSS article images render correctly
- `authStore` synced after saving site settings
- Rate-limit error code corrected; stale-request toasts suppressed; `pt` locale string fixes
- Profile-specific page title used in `AdminUserPage`
- `usePageTitle` moved after item state declaration in `ArticlePage` to fix hook order
- UTF-8 BOM removed and CRLF normalized to LF in migration files

### Dependencies

- `Microsoft.AspNetCore.Authentication.JwtBearer` → 10.0.6
- `Microsoft.AspNetCore.Mvc.Testing` → 10.0.6
- `MailKit` → 4.16.0
- `coverlet.collector` → 10.0.0
- `Microsoft.NET.Test.Sdk` → 18.4.0
- npm: `lucide-react` → 1.8.0, `vitest` → 4.1.4, `prettier` → 3.8.2, `@types/node`, `vite`, and other minor updates

---

## [1.0.1] — 2026-04-04

### Fixed

- Dockerfile and `docker-compose.yml` corrected for production deployment

---

## [1.0.0] — 2026-04-04

Initial public release of Pressmark — a self-hosted, open-source RSS aggregator.

Subscribe to RSS sources, build a personal reading feed, like articles, and discover
what the community is reading — all on your own infrastructure.

### Added

#### Feed & Articles

- Personal feed with cursor-based pagination and live gRPC streaming
- Community feed — publicly visible articles liked by users within a configurable time window
- Article page (`/article/:id`) with full content view and auto-expanded comments
- Filter feed by source — click any source name on Feed or Community page
- Dynamic community window days shown in page subtitle
- Feed cleanup via `feed_retention_days` setting with automatic `CleanupService`
- Parallelized feed enrichment queries; `TotalUnread` skipped on cursor pages

#### Comments & Reports

- Comment section on every article — add and delete your own comments
- Admin can remove any comment
- Report system — users report articles or comments; admins review with full enriched context
- HTML sanitization via `DOMParser` (CWE-116 compliant; replaces regex stripping)

#### Subscriptions & Bookmarks

- Subscribe to RSS sources and edit subscription display names
- Subscribe directly from the Community feed without leaving the page
- Bookmarks page with source filter (`?sub=subscriptionId`)
- Duplicate subscription guard — toast shown when re-subscribing to a known URL
- Banned source badge visible on Feed, Subscriptions page, and feed items

#### Admin Panel

- User management: ban/unban users, view user profiles, remove comments
- Source moderation: ban sources community-wide
- Hidden articles list with paginated view and unhide action
- Reports queue with enriched article/comment context and pagination
- Invite tokens with email notification; support for invite-only registration mode
- Skeleton loaders on all admin list views

#### Authentication & Security

- JWT strategy: access token in Zustand in-memory (15 min) + refresh token in `httpOnly` cookie (7 days)
- Silent token refresh on `Unauthenticated` gRPC errors via `authInterceptor` in `transport.ts`
- Cross-tab refresh token race condition prevention
- Security headers, HTTPS redirect, `SameSite=Strict` cookie policy
- `GUID.TryParse` hardening throughout the API
- Private data stripped from server warning logs

#### Email Notifications

- Comment notification emails sent to article authors
- Daily digest email for subscribed users
- SMTP password protected via `SmtpPasswordProtector`

#### Internationalization

- 18 locales via `react-i18next`
- Auto-detects browser language on first visit
- Locale switcher in sidebar, persisted in `localStorage`
- All UI strings use `t('ns:key')` — no hardcoded text

#### Infrastructure & CI/CD

- Docker + Docker Compose production setup with nginx reverse proxy
- Trivy container image vulnerability scanning in GitHub Actions
- Dependabot configured for npm and GitHub Actions dependencies
- `GITHUB_TOKEN` permissions restricted to `contents: read`
- Database backup strategy

#### Testing

- xUnit integration tests: feed isolation, auth token rotation, deduplication, migration smoke test
- MSSQL service container in CI for integration tests
- Vitest unit tests: `getYouTubeId`, `sanitizeSummary`, cursor round-trip, `LenientUtf8`
- `JwtService`, `OpmlService`, `SmtpPasswordProtector` unit tests
- Coverage gate ≥ 37% line coverage enforced on PRs to `main` via Cobertura XML

---

[1.2.0]: https://github.com/lopatnov/pressmark/releases/tag/v1.2.0
[1.1.0]: https://github.com/lopatnov/pressmark/releases/tag/v1.1.0
[1.0.1]: https://github.com/lopatnov/pressmark/releases/tag/v1.0.1
[1.0.0]: https://github.com/lopatnov/pressmark/releases/tag/v1.0.0
