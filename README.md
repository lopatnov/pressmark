[![CI](https://github.com/lopatnov/pressmark/actions/workflows/ci.yml/badge.svg)](https://github.com/lopatnov/pressmark/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/lopatnov/pressmark)](https://github.com/lopatnov/pressmark/issues)
[![GitHub stars](https://img.shields.io/github/stars/lopatnov/pressmark?style=social)](https://github.com/lopatnov/pressmark/stargazers)

# Pressmark

> Self-hosted RSS aggregator with a public community feed.

Subscribe to RSS sources, get your personal chronological feed, like and bookmark articles.
The public community page — articles liked by users — is open to anyone without an account.

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

| Layer          | Technology                                             |
| -------------- | ------------------------------------------------------ |
| Backend        | .NET 10 · ASP.NET Core · gRPC (`Grpc.AspNetCore`)      |
| Frontend       | React 19 · TypeScript (strict) · Vite                  |
| UI             | TailwindCSS v4 · shadcn/ui · lucide-react              |
| State          | Zustand                                                |
| Forms          | react-hook-form + zod                                  |
| i18n           | react-i18next (English by default)                     |
| API transport  | gRPC-web (`@connectrpc/connect-web`, no Envoy needed)  |
| Database       | MSSQL · EF Core 10 (Code First)                        |
| Authentication | JWT — access token in memory + httpOnly refresh cookie |
| Infrastructure | Docker · Docker Compose · nginx                        |
| CI/CD          | GitHub Actions                                         |

---

## Local Development

**Prerequisites:** [.NET 10 SDK](https://dotnet.microsoft.com/download) · [Node.js 22](https://nodejs.org/)

You need a running MSSQL instance — either **local** or **Docker**:

| Setup                 | Host port   | How to get MSSQL running                                                            |
| --------------------- | ----------- | ----------------------------------------------------------------------------------- |
| Docker                | `1434`      | `docker compose up db -d` (requires [Docker](https://docs.docker.com/get-docker/)) |
| Local MSSQL installed | `1433`      | Already running — change port to `1433` in `launchSettings.json` and `launch.json` |

The default connection string (`sa` / `Dev_Password1!`) targets **Docker on port 1434** and is pre-configured in `launchSettings.json` and `.vscode/launch.json`.
If using a local SQL Server instance, change `1434` → `1433` in `ConnectionStrings__Default` in both files.

Migrations are applied **automatically on startup** — no manual `dotnet ef` step required.

### Option A — VS Code (recommended)

1. Open the repo folder in VS Code.
2. Install recommended extensions when prompted (`.vscode/extensions.json`).
3. Ensure MSSQL is running:
   - **Docker** — open the Command Palette (`Ctrl+Shift+P`) → **Tasks: Run Task** → **db: start**.
     This runs `docker compose up db -d` and maps MSSQL to `localhost:1434`.
   - **Local MSSQL installed** — already running on `localhost:1433`; change the port in `launchSettings.json` and `.vscode/launch.json` (`1434` → `1433`).
4. Select **Full Stack (API + Vite)** and press **F5**.

This runs the .NET API with the debugger attached and launches the Vite dev server.
Breakpoints work in both the C# and TypeScript code simultaneously.

### Option B — terminal

```bash
# 1. Ensure MSSQL is running
#    Docker:       docker compose up db -d  (available at localhost:1434)
#    Local MSSQL:  already running at localhost:1433 — update port in launchSettings.json

# 2. Start the API (migrations apply automatically on first run)
dotnet run --project src/Pressmark.Api
# gRPC server at http://localhost:5000
# Check that server started at http://localhost:5000/health

# 3. Start the frontend  (separate terminal)
cd src/pressmark-web
npm install
npm run dev
# Open http://localhost:5173
# Vite proxies /grpc/* → http://localhost:5000 automatically
```

### Connecting a database client

Once the Docker MSSQL container is running (`docker compose up db -d`), connect with any SQL client:

| Setting                  | Value            |
| ------------------------ | ---------------- |
| Server                   | `localhost,1434` |
| Login                    | `sa`             |
| Password                 | `Dev_Password1!` |
| Trust server certificate | Yes              |

Compatible tools: [Azure Data Studio](https://aka.ms/azuredatastudio), SSMS, DBeaver, DataGrip.

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

### 2. Configure environment variables

A `.env` file is included in the repository with default values. **Before deploying to production, edit `.env`** and change:

| Variable              | What to set                                                    |
| --------------------- | -------------------------------------------------------------- |
| `MSSQL_SA_PASSWORD`   | Strong SA password (uppercase + lowercase + digit + symbol)    |
| `JWT_SECRET`          | Random secret, min 32 chars — `openssl rand -base64 32`        |
| `CORS_ALLOWED_ORIGINS`| Your public domain, e.g. `https://your-domain.com`            |

The remaining variables in `.env` have sensible defaults and rarely need changing.

### 3. Configure the database

By default, `docker-compose.yml` starts a bundled MSSQL container.
If you prefer to use an existing database (Azure SQL, a managed server, or a local instance),
follow the instructions in the comments at the top of the `db` service in `docker-compose.yml` —
they walk through removing the bundled container and pointing the API at an external server.

The connection string format is:

```
Server=<host>,<port>;Database=pressmark;User Id=<user>;Password=<pass>;TrustServerCertificate=True
```

For local development without Docker, edit `src/Pressmark.Api/Properties/launchSettings.json`
and update the `ConnectionStrings__Default` value there.

EF Core applies migrations automatically on startup. To run them manually:

```bash
dotnet ef database update --project src/Pressmark.Api
```

### 4. Start the stack

```bash
docker compose up -d
```

This starts:

- **db** — Microsoft SQL Server
- **api** — .NET gRPC server (applies migrations on startup)
- **web** — nginx serving the React SPA and proxying `/grpc/*` to the API

Open **http://your-server-ip**. The first registered account automatically becomes **Admin**.

### 5. HTTPS (recommended)

The nginx config and Docker Compose file contain commented-out instructions for enabling TLS:

1. **`nginx/nginx.conf`** — uncomment the `server { listen 443 ssl; ... }` block and fill in your certificate paths.
2. **`docker-compose.yml`** — uncomment the `"443:443"` port mapping in the `web` service.

Certificates can be obtained via [Let's Encrypt / certbot](https://certbot.eff.org/) and mounted as a read-only volume into the `web` container (see the comment in `nginx/nginx.conf`).

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
| `ConnectionStrings__Default`  | _(required)_            | MSSQL connection string                             |
| `Jwt__Secret`                 | _(required)_            | JWT signing secret — min 32 chars, **change this!** |
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
