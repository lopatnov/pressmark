# CLAUDE.md — Context & Guidelines for Pressmark

Примечание - адаптация Claude.md и то что в папке .claude далека от желаемого результата. Проект уже готов и ему нужна только лишь поддержка и потенциальная готовность к расширению, но то что получили из моего локального шаблона claude template - несколько хуже чем то что было до этого. Я ожидаю что поддержка со временем изменит код до академического, до такого с которого можно брать пример. Пока текущие инструкции этому не способствуют. Пожалуйста переработай хорошенько Claude.md и .claude папку для текущих потребностей. А для задач открыт проект на GitHub

## Как работает команда (читать первым)

Главная сессия Claude — **дирижёр**: она вызывает агентов-специалистов на «воротах» процесса.
Перед работой прочитай: [`.claude/rules/index.md`](.claude/rules/index.md) →
[`.claude/rules/workflow.md`](.claude/rules/workflow.md) →
[`.claude/rules/team.md`](.claude/rules/team.md) →
[`.claude/rules/conventions.md`](.claude/rules/conventions.md).

**Разделение ответственности файлов:**

- **Процесс команды** (агенты, правила, ворота, RACI) — в `.claude/`.
- **Специфика этого проекта** (стек, конвенции кода, команды сборки) — здесь, в CLAUDE.md,
  и в `.claude/docs/*.md` для развёрнутых how-to (добавление gRPC-эндпоинта, добавление страницы,
  обновление зависимостей).

---

## Project Overview

**Pressmark** — self-hosted RSS-агрегатор с публичной community-лентой. Пользователи подписываются
на RSS-источники, получают персональную хронологическую ленту, лайкают и добавляют статьи в
закладки. Публичная страница community (топ лайкнутых статей) доступна без аккаунта.

Главные фичи: персональная лента + read/unread, community-страница, лайки/закладки, админ-панель
(настройки сайта, модерация, пользователи), invite-only режим, комментарии с email-уведомлениями,
дневной дайджест, OPML-импорт/экспорт, SEO (sitemap.xml, robots.txt, OpenGraph).

## Tech Stack

- **Backend:** .NET 10, ASP.NET Core, gRPC (Grpc.AspNetCore + code-first контракты в `.proto`),
  Entity Framework Core (SQL Server), фоновые сервисы (`BackgroundServices/`) для фетча RSS и
  дайджестов.
- **Frontend:** React 19 + TypeScript + Vite. Роутинг — `react-router-dom` (Data Router,
  `RouterProvider`, без SSR/framework mode). Состояние — `zustand`. Формы — `react-hook-form` +
  `zod`. UI — `radix-ui` / `shadcn` компоненты + Tailwind CSS v4. gRPC-клиент — `@connectrpc/connect`
  - `@connectrpc/connect-web` поверх сгенерированного `@bufbuild/protobuf` кода (`buf generate`).
- **Database:** MSSQL через EF Core Migrations (`src/Pressmark.Api/Migrations`).
- **Локализация:** `i18next` / `react-i18next`, 18 локалей в `src/pressmark-web/src/i18n/locales/`
  (`cs de en es fr hu it ja ko nl pl pt ro ru sv tr uk zh`). Все строки UI — только через
  `t('ns:key')`, никакого хардкода текста.
- **Прочее:** Docker Compose для локального стека (`docker compose up`), nginx перед SPA-сборкой в
  контейнере, SMTP для email (инвайты, сброс пароля, дайджест, уведомления о комментариях).

---

## Architecture & Features

### Backend — `src/Pressmark.Api/Services/`

Сервисы реализуют gRPC-контракты как **partial-классы, разбитые по под-доменам**, плюс вынесенные
помощники не завязанные на gRPC (мапперы, снапшоты, guard-хелперы). Это устоявшийся стиль после
архитектурного рефакторинга файлов >300 строк (PR #66) — **новые фичи пиши сразу в этом стиле**,
не давай одному файлу сервиса расти обратно до сотен строк.

Пример на `Admin`/`Auth`/`Feed`:

- `AdminServiceImpl.cs` (основной класс) + `AdminServiceImpl.Invites.cs` +
  `AdminServiceImpl.Moderation.cs` + `AdminServiceImpl.Users.cs` — partial-классы по под-доменам
  одного gRPC-сервиса.
- `AuthServiceImpl.cs` + `AuthServiceImpl.PasswordReset.cs` + `AuthServiceImpl.Session.cs` —
  та же схема.
- `FeedServiceImpl.cs` + `FeedServiceImpl.Comments.cs` + `FeedServiceImpl.Engagement.cs`.
- Вынесенные helpers (не partial, отдельная ответственность): `RpcGuards.cs` (общие проверки прав
  доступа/валидации запроса), `AdminMapper.cs` / `FeedItemMapper.cs` (маппинг Entity ↔ gRPC-модель),
  `SiteSettingsSnapshot.cs` (иммутабельный снимок настроек сайта для чтения без лишних запросов к
  БД), `FeedPageAssembler.cs`, `FeedQueryExtensions.cs`, `CursorHelper.cs`, `PagingDefaults.cs`,
  `AdminPaging.cs` (курсорная пагинация, вынесена из сервисов).

Правило: если метод сервиса делает что-то, не завязанное напрямую на `ServerCallContext`/gRPC-модель
запроса-ответа (маппинг, вычисление, чистая проверка) — выносить в отдельный `static`/DI-хелпер, а
не разрастать сам `*ServiceImpl`. Если под-домен сервиса обрастает несколькими RPC-методами —
выносить в свой `*ServiceImpl.<Субдомен>.cs` partial-файл, а не в общий.

### Frontend — `src/pressmark-web/src/`

Страница = **тонкий layout-компонент** (`src/pages/*Page.tsx`) + **хук `useXxx`**
(`src/hooks/use*.ts`), который держит состояние и gRPC-вызовы, + презентационные компоненты
(`src/components/**`). Это тоже устоявшийся стиль после PR #66 — держи новые страницы в этом же
разрезе, а не сваливай состояние/RPC/JSX в один файл на 700 строк.

Пример: `src/pages/FeedPage.tsx` (~140 строк, layout + рендер состояний loading/error/empty/data)

- `src/hooks/useFeedPage.ts` (~190 строк, вся логика: gRPC-запросы, курсорная пагинация,
  фильтры, side-effects). Аналогично: `AdminUserPage.tsx` ↔ `useAdminUserDetails.ts`,
  `CommunityPage.tsx` ↔ `useCommunityFeed.ts`, `SubscriptionsPage.tsx` ↔ `useSubscriptions.ts`,
  `AdminPage.tsx` ↔ `useAdminPaginatedList.ts`.

Правило: страница не делает gRPC-вызовы напрямую и не хранит бизнес-состояние — это забота хука.
Хук не рендерит JSX. Общие переиспользуемые куски хука (пагинация через `IntersectionObserver`,
заголовок вкладки) уже вынесены в `useIntersectionLoader.ts` / `usePageTitle.ts` — используй их
вместо копипасты, а не изобретай заново.

### Как заводить новые фичи

Пошаговые инструкции по образцу существующего кода — в
[`.claude/docs/extending-the-app.md`](.claude/docs/extending-the-app.md):

- добавление нового gRPC-сервиса/эндпоинта (proto-контракт → partial-реализация → регистрация → DI);
- добавление новой страницы фронтенда (page + hook + маршрут + локализация).

## Data / Domain Model

Схема — через EF Core миграции (`src/Pressmark.Api/Migrations`), сущности — `src/Pressmark.Api/Entities`.
Ключевые сущности (см. код для актуальных полей — не дублируем схему здесь, чтобы не рассинхронизироваться
с миграциями):

- `User` ↔ `Subscription` ↔ `Feed`/`FeedSource` — подписки пользователя на RSS-источники.
- `FeedItem` — отдельная статья из источника; `Like`, `Bookmark` — реакции пользователя на статью.
- `Comment` — комментарии к статье, с подпиской на уведомления по треду.
- `Invite` — инвайт-коды для invite-only режима.
- `SiteSettings` — общесайтовые настройки (имя сайта, community-окно, invite-only и т.п.), читаются
  через `SiteSettingsSnapshot`.

Перед добавлением новой сущности/миграции — свериться с текущей схемой в `Entities/` и
`Migrations/`, а не полагаться на память.

---

## Code & Quality Guidelines

### Общие принципы (наследуются из `.claude/rules/`)

- **Простота важнее «умности».** Код пишется «как окружающий код» (стиль, нейминг, комментарии).
- **Билд зелёный перед коммитом** (0 ошибок), предупреждения просмотрены — см.
  [`.claude/rules/index.md`](.claude/rules/index.md), «Дисциплина билдов».
- **Коммиты/ветки/версии** — Conventional Commits (см. `.claude/rules/conventions.md` и
  `CONTRIBUTING.md` — тип без точки, императив, английский язык).
- **Весь код, комментарии и коммиты — на английском** (см. `CONTRIBUTING.md`).

### Специфика стека

- **Backend:** `async`/`await` везде, `CancellationToken` прокидывается в методы сервисов.
  Партиал-классы по под-доменам + вынесенные мапперы/guard-хелперы (см. «Architecture» выше) —
  не полагаемся на один разрастающийся `*ServiceImpl.cs`.
- **Frontend:** только функциональные компоненты. Вся видимая пользователю строка — через
  `t('ns:key')` (`react-i18next`), никакого хардкода текста ни в одном из 18 языков по умолчанию —
  как минимум добавляй ключ в `en` (и `ru`), остальные локали может добить `translator`/CI.
- **Доступ к данным:** EF Core, миграции обязательны при изменении схемы (`dotnet ef migrations add`
  из `src/Pressmark.Api`).
- **Безопасность:** аутентификация — JWT (`JwtService`, `AuthTokenIssuer`), проверки прав — через
  `RpcGuards`. Чувствительные операции (auth, инвайты, admin, email) — на ревью
  `security-engineer` при нетривиальных изменениях.

### Frontend / UI

- Страница = layout + `useXxx` хук + презентационные компоненты (см. «Architecture» выше).
- Состояния loading/error/empty — обязательны на каждой странице со списком данных.
- Компоненты `radix-ui`/`shadcn` предпочтительнее кастомных — не изобретай то, что уже есть в UI-ките.

---

## Commands Reference

> ⚠️ На эти команды опираются `/build`, агент `build-validator` и скилл `testing`.

### Development

- `docker compose up` — поднять весь стек локально (backend + frontend + MSSQL), см. README.
- `dotnet run --project src/Pressmark.Api` — запустить backend напрямую.
- `cd src/pressmark-web && npm run dev` — запустить frontend (Vite dev server).
- `cd src/pressmark-web && npm run generate` — перегенерировать gRPC-клиент из `.proto` (`buf generate`).

### Build

- `dotnet restore` — восстановить NuGet-пакеты (из корня репозитория, решение `Pressmark.slnx`).
- `dotnet build --configuration Release` — собрать backend, 0 ошибок обязательны.
- `cd src/pressmark-web && npm run build` — собрать frontend (`tsc -b && vite build`), 0 ошибок TypeScript.

### Format / Lint

- `dotnet format src/Pressmark.Api/Pressmark.Api.csproj --verify-no-changes` — проверка форматирования backend.
- `dotnet format src/Pressmark.Api.Tests/Pressmark.Api.Tests.csproj --verify-no-changes` — то же для тестового проекта.
- `cd src/pressmark-web && npm run format:check` — проверка форматирования frontend (Prettier); `npm run format` — исправить.
- `cd src/pressmark-web && npm run lint` — ESLint.
- `cd src/pressmark-web && npm run typecheck` — `tsc --noEmit`, отдельно от `build` для быстрой проверки типов.

### Testing

- `dotnet test --configuration Release` — backend unit/integration тесты (xUnit, `src/Pressmark.Api.Tests`).
- `cd src/pressmark-web && npm run test` — frontend тесты (Vitest + coverage, `vitest run --coverage.enabled`).

### Database / Migrations

- `dotnet ef migrations add <Name> --project src/Pressmark.Api` — создать миграцию.
- `dotnet ef database update --project src/Pressmark.Api` — применить миграции локально.

### Dependencies

- Патч-обновления / security-фиксы — обычный Dependabot-флоу.
- Обновление до **действительно последних** версий (включая мажорные) — см. скилл
  [`.claude/skills/dependency-freshness/SKILL.md`](.claude/skills/dependency-freshness/SKILL.md).
  Не полагайся на то, что `npm install`/`dotnet add package` сами возьмут самое новое — они могут
  закрепиться на закэшированной или совместимой, но не последней версии.

### CI (для справки, ничего не запускать вручную без причины)

CI (`.github/workflows/ci.yml`) гоняет ровно тот же набор команд в том же порядке — если локально
всё зелёное, CI тоже должен быть зелёным.

---

## Project-specific notes

- Решение — `Pressmark.slnx` (новый формат `.slnx`, не `.sln`).
- Ветка `claude/pressmark-maintenance-iez7t3` может быть занята параллельной сессией — перед
  правками в `.claude`/`CLAUDE.md` проверяй `git status`/`git worktree list`, не трогай чужие
  незакоммиченные изменения.
- Публичная community-страница и часть SEO-эндпоинтов доступны без аутентификации — при
  ревью безопасности учитывать, что не всё требует auth намеренно.
- Локализация: при добавлении/изменении UI-строки — обязательно ключ в `en`, `ru`; остальные
  16 локалей могут временно отставать (это не блокирует Quality gate, но фиксируется в backlog
  для `translator`).
