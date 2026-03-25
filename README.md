[![CI](https://github.com/lopatnov/pressmark/actions/workflows/ci.yml/badge.svg)](https://github.com/lopatnov/pressmark/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/lopatnov/pressmark?style=social)](https://github.com/lopatnov/pressmark/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/lopatnov/pressmark)](https://github.com/lopatnov/pressmark/issues)

# Pressmark

> Self-hosted RSS aggregator with a public community feed.

Subscribe to RSS sources, get your personal chronological feed, like and bookmark articles,
and discover what the community is reading right now — no account required for the public page.

Built as a portfolio demonstration of the **.NET 10 · gRPC · React 19 · TypeScript · MSSQL · Docker** stack.

---

## Features

- **Personal feed** — subscribe to any RSS source, track read/unread status
- **Public community page** — top-liked articles from the last N days, visible without an account
- **Like & bookmark** — like articles to surface them on the community page; bookmark privately for later
- **Admin panel** — configure site name, community window, moderate content, view user list
- **One-command setup** — `docker compose up` starts the full stack
- **Invite-only mode** — optionally restrict registration (configurable in admin)

---

## Tech Stack

| Layer              | Technology                                            |
| ------------------ | ----------------------------------------------------- |
| Backend            | .NET 10 · ASP.NET Core · gRPC (`Grpc.AspNetCore`)    |
| Frontend           | React 19 · TypeScript (strict) · Vite                 |
| UI                 | TailwindCSS v4 · shadcn/ui · lucide-react             |
| State              | Zustand                                               |
| Forms              | react-hook-form + zod                                 |
| i18n               | react-i18next (English by default)                    |
| API transport      | gRPC-web (`@connectrpc/connect-web`, no Envoy needed) |
| Database           | MSSQL · EF Core 10 (Code First)                       |
| Authentication     | JWT — access token in memory + httpOnly refresh cookie|
| Infrastructure     | Docker · Docker Compose · nginx                       |
| CI/CD              | GitHub Actions                                        |

---

## Local Development

**Prerequisites:** [.NET 10 SDK](https://dotnet.microsoft.com/download) · [Node.js 22](https://nodejs.org/) · [Docker](https://docs.docker.com/get-docker/)

### Option A — VS Code (recommended)

1. Open the repo folder in VS Code.
2. Install recommended extensions when prompted (`.vscode/extensions.json`).
3. Press **F5** and select **Full Stack (API + Vite)**.

This starts MSSQL in Docker, runs the .NET API with the debugger attached, and launches the Vite dev server.
Breakpoints work in both the C# and TypeScript code simultaneously.

### Option B — terminal

```bash
# 1. Start MSSQL
docker compose up db -d
# Available at localhost:1433  (sa / Dev_Password1!)

# 2. Apply migrations
dotnet ef database update --project src/Pressmark.Api

# 3. Start the API  (env vars pre-filled in launchSettings.json)
dotnet run --project src/Pressmark.Api
# gRPC server at http://localhost:5000

# 4. Start the frontend  (separate terminal)
cd src/pressmark-web
npm install
npm run dev
# Open http://localhost:5173
# Vite proxies /grpc/* → http://localhost:5000 automatically
```

### Debugging tips

**Backend (C#):**
- VS Code attaches the .NET debugger automatically via `launch.json`.
- To attach to an already-running process: **Run → Attach to Process** → select `dotnet`.
- Structured logs appear in the Debug Console; set `Logging:LogLevel:Default` to `Debug` in `appsettings.Development.json` for verbose output.

**Frontend (TypeScript):**
- Vite source maps are enabled in dev mode — set breakpoints directly in `.tsx` files inside VS Code.
- gRPC-web calls use plain HTTP/1.1 and are visible in the browser **Network** tab as POST requests to `/grpc/<ServiceName>/<MethodName>`.
- The Zustand devtools middleware exposes all store state in the **Redux DevTools** browser extension.

---

## Production Deployment

**Prerequisites:** a Linux server (or any host) with Docker and Docker Compose installed.

### 1. Clone the repository

```bash
git clone https://github.com/lopatnov/pressmark.git
cd pressmark
```

### 2. Set required environment variables

Create a `.env` file next to `docker-compose.yml` (it is gitignored):

```env
# Generate a strong secret: openssl rand -base64 32
JWT_SECRET=replace-with-a-long-random-string

# Change the SA password — must meet MSSQL complexity requirements
MSSQL_SA_PASSWORD=Your_Strong_Password1!

# Set to your actual domain
CORS_ALLOWED_ORIGINS=https://your-domain.com
```

Then update `docker-compose.yml` to reference these variables, or pass them inline:

```bash
JWT_SECRET=... MSSQL_SA_PASSWORD=... CORS_ALLOWED_ORIGINS=https://your-domain.com \
  docker compose up -d
```

### 3. Start the stack

```bash
docker compose up -d
```

This starts:
- **db** — Microsoft SQL Server
- **api** — .NET gRPC server (applies migrations on startup)
- **web** — nginx serving the React SPA and proxying `/grpc/*` to the API

Open **http://your-server-ip**. The first registered account automatically becomes **Admin**.

### 4. HTTPS (recommended)

The included nginx config listens on port 80. For TLS, put a reverse proxy in front — for example [nginx-proxy + acme-companion](https://github.com/nginx-proxy/acme-companion) or [Caddy](https://caddyserver.com/):

```bash
# Caddy example — automatic HTTPS via Let's Encrypt
caddy reverse-proxy --from your-domain.com --to localhost:80
```

Or edit `nginx/nginx.conf` to add an SSL listener and mount your certificates.

---

## Architecture

```
Browser
  │  gRPC-web (Connect protocol over HTTP/1.1)
  ▼
┌──────────────────────────────────┐
│  Dev:  Vite dev server  :5173   │
│  Prod: nginx            :80     │
│        /         → React SPA    │
│        /grpc/*   → API proxy    │
└──────────────┬───────────────────┘
               │
               ▼
┌────────────────────────────────────────────┐
│  .NET 10 gRPC Server  :5000               │
│  ├── AuthService        (Register/Login)   │
│  ├── SubscriptionService                   │
│  ├── FeedService        (feed, likes, …)   │
│  ├── AdminService       (role=Admin only)  │
│  └── RssFetcherService  (BackgroundService │
│                          polls every N min)│
└──────────────┬─────────────────────────────┘
               │  EF Core (Code First)
               ▼
       Microsoft SQL Server
```

No Envoy proxy needed — `app.UseGrpcWeb()` on the .NET side handles the browser-to-gRPC translation.

---

## Project Structure

```
pressmark/
├── proto/                    # gRPC contracts (source of truth)
│   ├── auth.proto
│   ├── subscription.proto
│   ├── feed.proto
│   └── admin.proto
├── src/
│   ├── Pressmark.Api/        # .NET 10 gRPC server
│   │   ├── Entities/         # EF Core entities
│   │   ├── Data/             # AppDbContext + migrations
│   │   ├── Services/         # gRPC service implementations
│   │   └── Program.cs
│   ├── Pressmark.Api.Tests/  # xUnit + Moq
│   └── pressmark-web/        # React SPA (Vite)
│       └── src/
│           ├── pages/        # CommunityPage, FeedPage, AdminPage, …
│           ├── components/   # UI components, Sidebar, AppLayout
│           ├── store/        # Zustand stores
│           ├── router/       # Routes, ProtectedRoute, AdminRoute
│           └── i18n/         # Locale files
├── nginx/nginx.conf           # Prod: static SPA + gRPC proxy
├── docker-compose.yml
└── .vscode/                   # Launch configs + recommended extensions
```

---

## Environment Variables

| Variable                      | Default                 | Description                                         |
| ----------------------------- | ----------------------- | --------------------------------------------------- |
| `ConnectionStrings__Default`  | *(required)*            | MSSQL connection string                             |
| `Jwt__Secret`                 | *(required)*            | JWT signing secret — min 32 chars, **change this!** |
| `Jwt__ExpiryMinutes`          | `15`                    | Access token lifetime (minutes)                     |
| `Jwt__RefreshExpiryDays`      | `7`                     | Refresh token lifetime (days)                       |
| `Jwt__RefreshCookieName`      | `refresh_token`         | Name of the httpOnly refresh cookie                 |
| `Cors__AllowedOrigins`        | `http://localhost:5173` | Allowed CORS origins                                |
| `RssFetcher__IntervalMinutes` | `15`                    | How often to poll RSS feeds                         |
| `RssFetcher__MaxItemsPerFeed` | `50`                    | Maximum items fetched per feed per poll             |

---

## Running Tests

```bash
# Backend
dotnet test

# Frontend (TypeScript type-check + build)
cd src/pressmark-web && npm run build
```

---

## Adding a Migration

```bash
dotnet ef migrations add <MigrationName> --project src/Pressmark.Api
dotnet ef database update --project src/Pressmark.Api
```

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

- Bug reports → [open an issue](https://github.com/lopatnov/pressmark/issues)
- Questions → [Discussions](https://github.com/lopatnov/pressmark/discussions)
- Found it useful? A [star on GitHub](https://github.com/lopatnov/pressmark) helps others discover the project

---

## License

[GNU General Public License v3.0](LICENSE) © 2026 [Oleksandr Lopatnov](https://github.com/lopatnov) · [LinkedIn](https://www.linkedin.com/in/lopatnov/)
