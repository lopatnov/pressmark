# Pressmark

A self-hosted RSS aggregator with a personal feed and a public community page.
Built as a portfolio project demonstrating **gRPC · .NET 10 · React 19 · TypeScript · EF Core · MSSQL · Docker**.

## Features

- Subscribe to RSS sources — the server polls them every 15 minutes
- Personal chronological feed with read/unread tracking
- Like articles → they appear on the public community page
- Bookmark articles privately for later reading
- Anonymous visitors can browse the community feed without an account
- Admin panel: site settings, content moderation, user management
- First registered user automatically becomes Admin

## Tech stack

| Layer | Technology |
|---|---|
| Backend | .NET 10, ASP.NET Core, gRPC (`Grpc.AspNetCore`) |
| Frontend | React 19, TypeScript strict, Vite |
| UI | TailwindCSS v4 + shadcn/ui + Lucide icons |
| State | Zustand |
| Forms | react-hook-form + zod |
| i18n | react-i18next (English by default) |
| gRPC-web | `@connectrpc/connect-web` (no Envoy required) |
| Database | MSSQL, EF Core 10 Code First |
| Auth | JWT — access token in memory + refresh token in httpOnly cookie |
| Infrastructure | Docker Compose, nginx |

---

## Prerequisites

| Tool | Version |
|---|---|
| .NET SDK | 10.0+ |
| Node.js | 20+ |
| Docker Desktop | any recent |
| dotnet-ef | `dotnet tool install -g dotnet-ef` |

---

## Quick start (Docker)

```bash
docker compose up
```

Opens on `http://localhost`.
The first registered account becomes Admin.

---

## Local development

### 1. Start the database

```bash
docker compose up db -d
```

Starts MSSQL on `localhost:1433`. Credentials: `sa` / `Dev_Password1!`.

### 2. Apply migrations

```bash
dotnet ef database update --project src/Pressmark.Api
```

### 3. Run the API

```bash
dotnet run --project src/Pressmark.Api
```

API listens on `http://localhost:5000`.
All env vars are pre-filled in `src/Pressmark.Api/Properties/launchSettings.json`.

### 4. Run the frontend

```bash
cd src/pressmark-web
npm install
npm run dev
```

Opens on `http://localhost:5173`.
Vite proxies `/grpc/*` → `http://localhost:5000` automatically.

### VS Code

Open the repo folder, press **F5** and select **Full Stack (API + Vite)** — starts both the API and the Vite dev server in one shot.
Install recommended extensions when prompted (`.vscode/extensions.json`).

---

## Project structure

```
pressmark/
├── proto/                  # gRPC contracts (source of truth)
│   ├── auth.proto
│   ├── subscription.proto
│   ├── feed.proto
│   └── admin.proto
├── src/
│   ├── Pressmark.Api/      # .NET 10 gRPC server
│   │   ├── Entities/       # EF Core entities
│   │   ├── Data/           # AppDbContext + migrations
│   │   ├── Services/       # gRPC service implementations
│   │   └── Program.cs
│   ├── Pressmark.Api.Tests/ # xUnit + Moq
│   └── pressmark-web/      # React SPA
│       └── src/
│           ├── pages/      # CommunityPage, FeedPage, AdminPage, ...
│           ├── store/      # Zustand stores
│           ├── router/     # Routes, ProtectedRoute, AdminRoute
│           └── i18n/       # Locale files
├── nginx/nginx.conf        # Production: static SPA + gRPC proxy
├── docker-compose.yml
└── .vscode/                # Launch configs + recommended extensions
```

---

## Running tests

```bash
# Backend
dotnet test

# Frontend
cd src/pressmark-web
npm test
```

---

## Environment variables

All variables below are consumed by the API container.
For local dev they are set in `launchSettings.json` (not committed with secrets).

| Variable | Default | Description |
|---|---|---|
| `ConnectionStrings__Default` | — | MSSQL connection string |
| `Jwt__Secret` | — | JWT signing secret (min 32 chars) |
| `Jwt__ExpiryMinutes` | `15` | Access token lifetime |
| `Jwt__RefreshExpiryDays` | `7` | Refresh token lifetime |
| `Jwt__RefreshCookieName` | `refresh_token` | httpOnly cookie name |
| `Cors__AllowedOrigins` | `http://localhost:5173` | Allowed CORS origins |
| `RssFetcher__IntervalMinutes` | `15` | RSS polling interval |
| `RssFetcher__MaxItemsPerFeed` | `50` | Max items stored per feed |

---

## Adding a migration

```bash
dotnet ef migrations add <MigrationName> --project src/Pressmark.Api
dotnet ef database update --project src/Pressmark.Api
```
