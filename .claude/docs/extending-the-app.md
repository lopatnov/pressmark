# Extending the app — по образцу существующего кода

> Стек-специфичные how-to (в отличие от `.claude/rules/*`). Пиши новую фичу по этим шагам, а не
> с нуля — так новый код сразу ложится в устоявшийся после PR #66 разрез (см. «Architecture»
> в `CLAUDE.md`) и не разрастается обратно до одного файла на сотни строк.

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
