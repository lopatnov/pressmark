# Extending the app — по образцу существующего кода

> Стек-специфичные how-to (в отличие от `.claude/rules/*`). Пиши новую фичу по этим шагам, а не
> с нуля — так новый код сразу ложится в устоявшийся после PR #66 разрез (см. «Architecture»
> в `CLAUDE.md`) и не разрастается обратно до одного файла на сотни строк.

## Предпочитай CLI-генерацию ручному коду по памяти

Твои знания о библиотеках фиксированы на момент обучения, а сами CLI-инструменты (dotnet SDK,
EF Core tools, shadcn, buf) обновляются заметно чаще и генерируют код под свои **текущие** API и
конвенции — не под то, что ты помнишь. Для нового модуля/компонента/библиотеки в проекте — сначала
проверь, есть ли для него официальный генератор, и используй его вместо ручного кода по памяти:
- **shadcn-компонент** — `npx shadcn@latest add <component>` (из `src/pressmark-web`), не переписывай
  Radix-обёртку руками: CLI подтянет разметку, актуальную для установленных версий Tailwind/Radix.
- **EF Core миграция** — `dotnet ef migrations add <Name> --project src/Pressmark.Api`, не пиши
  класс миграции вручную — API `Migration`/`ModelBuilder` менялся между версиями EF Core.
- **gRPC/protobuf клиент** — `npm run generate` (`buf generate`) после правки `.proto`, не пиши
  сгенерированные типы руками (см. шаг «Codegen» ниже).
- Если нужен CLI-скаффолд, которого ещё нет в проекте (новый .NET-проект, новый npm-пакет с шаблоном)
  — сначала проверь `dotnet new <template>` / `npm create <tool>` / аналог, прежде чем создавать
  файлы с нуля вручную.

Сгенерированное CLI — всё равно проверяй и приводи к стилю проекта (`build-validator`, партиал-
классы/page+hook): CLI не знает про конвенции конкретно этого репозитория, только про свои.

## Изучай реальный код зависимостей, а не только память о нём

Если не уверен в актуальном API/возможностях зависимости (особенно активно развивающейся —
`@connectrpc/*`, `radix-ui`, EF Core, `react-router-dom`) — не гадай по обучающим данным, под рукой
есть более надёжные источники:
- **Уже скачанный локально код.** npm-зависимости лежат распакованными в `node_modules/<pkg>` —
  это реальный исходный код установленной версии, не только `.d.ts`; читай его напрямую вместо
  предположений. NuGet-пакеты кэшируются в `~/.nuget/packages/<pkg>/<version>/`.
- **Исходный репозиторий зависимости.** Если локального кода/доков недостаточно (нужна история
  изменений, issues, примеры использования из реальных проектов) — предложи пользователю подключить
  репозиторий зависимости к сессии (инструмент `add_repo`) и изучи его так же, как код этого
  проекта. Это надёжнее, чем полагаться на возможно устаревшее знание о библиотеке.

## Добавление нового gRPC-сервиса/эндпоинта

1. **Контракт.** Добавь/расширь `.proto` в `proto/` (по образцу `proto/feed.proto`,
   `proto/admin.proto`). Новый сервис — новый файл; новый метод существующего сервиса — правь
   существующий `.proto`.
2. **Codegen.** `cd src/pressmark-web && npm run generate` (`buf generate`) — перегенерирует
   TypeScript-клиент. Backend получает контракт через ссылку на `.proto` в `Pressmark.Api.csproj`
   (`Grpc.AspNetCore` code-first C# codegen при сборке) — `dotnet build` подтянет новые типы.
3. **Реализация на backend.** В `src/Pressmark.Api/Services/`:
   - Новый сервис целиком → `<Name>ServiceImpl.cs`, наследует сгенерированный `<Name>.<Name>Base`.
   - Новый RPC-метод в существующем сервисе, относящийся к отдельному под-домену (как
     `AdminServiceImpl.Invites.cs`, `AuthServiceImpl.Session.cs`, `FeedServiceImpl.Comments.cs`) →
     новый `partial` файл `<Name>ServiceImpl.<Субдомен>.cs`, а не в основной файл сервиса.
   - Общие проверки прав/валидации → `RpcGuards.cs` (не дублируй в каждом методе).
   - Маппинг Entity ↔ gRPC-модель → `<Name>Mapper.cs` (по образцу `AdminMapper.cs`,
     `FeedItemMapper.cs`), не инлайни маппинг в теле RPC-метода.
   - Курсорная пагинация → переиспользуй `CursorHelper.cs` / `PagingDefaults.cs`
     (`AdminPaging.cs` — пример специализации под конкретный список).
4. **Регистрация.** `builder.Services.AddGrpc()` уже стоит в `Program.cs`; для нового сервиса
   добавь `app.MapGrpcService<NewServiceImpl>();` рядом с существующими (`Program.cs`, около
   `MapGrpcService<FeedServiceImpl>()` и т.д.). Если эндпоинту нужен отдельный rate-limit —
   `.RequireRateLimiting("<policy>")` как у `AuthServiceImpl` (`"auth"`).
5. **Тесты.** `src/Pressmark.Api.Tests` — xUnit-тест на новый RPC-метод (happy path + отказ
   авторизации/валидации через `RpcGuards`).
6. **Frontend-клиент.** После `npm run generate` вызывай новый метод через
   `@connectrpc/connect`/`@connectrpc/connect-web` из хука страницы (см. ниже), не из компонента
   напрямую.
7. Проверка: `dotnet build --configuration Release && dotnet test --configuration Release`
   (см. Commands Reference в `CLAUDE.md`).

## Добавление новой страницы фронтенда

1. **Хук.** `src/hooks/use<Name>.ts` — здесь живёт state, gRPC-вызовы, side-effects, courtesy
   курсорной подгрузки (переиспользуй `useIntersectionLoader.ts` если список с infinite scroll) и
   заголовок вкладки (`usePageTitle.ts`). По образцу `useFeedPage.ts` / `useCommunityFeed.ts` /
   `useSubscriptions.ts`.
2. **Страница.** `src/pages/<Name>Page.tsx` — тонкий layout-компонент: вызывает хук, рендерит
   состояния loading/error/empty/data через презентационные компоненты из `src/components/**`.
   Никакой бизнес-логики и прямых gRPC-вызовов в самом файле страницы (это ответственность хука).
3. **Маршрут.** `src/router/index.tsx`:
   - Публичная страница без layout приложения → рядом с `LoginPage`/`RegisterPage` в корне
     `RootLayout`.
   - Страница внутри приложения → под `AppLayout`; если нужен доступ только вошедшим —
     под `<ProtectedRoute />` (как `/feed`, `/subscriptions`, `/bookmarks`); только админам —
     под `<AdminRoute />` (как `/admin`); публичная страница внутри `AppLayout` — под
     `<CommunityRoute />`.
   - Некритичные для первого рендера страницы — оборачивай в `lazy()` + `withSuspense(...)`, как
     все страницы кроме `Login`/`Register`/`ForgotPassword`/`ResetPassword`.
4. **Локализация.** Каждая видимая строка — через `t('ns:key')` (`react-i18next`). Добавь ключи
   как минимум в `en` и `ru` (`src/pressmark-web/src/i18n/locales/`); остальные 16 локалей можно
   добить отдельной задачей позже — это не блокирует мерж.
5. **Тесты.** Component-тест страницы (Vitest + Testing Library) по образцу `FeedPage.test.tsx` —
   рендер через `MemoryRouter` (см. `inviteOnly.test.tsx` для примера обёртки роутером).
6. Проверка: `npm run typecheck && npm run lint && npm run test && npm run build` (см. Commands
   Reference в `CLAUDE.md`).

## Definition of Done для обоих сценариев
Реализация ложится в существующий разрез файлов (partial-классы backend / page+hook frontend),
не создаёт новый файл >300 строк без явной причины, тесты добавлены, билд/линт/тесты зелёные
(`build-validator`), локализация задета минимум для `en`/`ru`.
