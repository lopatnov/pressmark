# Changelog

All notable changes to Pressmark are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.1]: https://github.com/lopatnov/pressmark/releases/tag/v1.0.1
[1.0.0]: https://github.com/lopatnov/pressmark/releases/tag/v1.0.0
