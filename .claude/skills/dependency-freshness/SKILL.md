---
name: dependency-freshness
description: Чек-лист обновления зависимостей Pressmark до ДЕЙСТВИТЕЛЬНО последних версий — включая мажорные, фреймворк (.NET SDK, React), Docker-образы и GitHub Actions — а не только то, что молча подтянет `npm install`/`dotnet add package`, и не только то, что предложит Dependabot патчами. Применяй по запросу пользователя на плановое обновление зависимостей, или когда `npm outdated`/`dotnet list package --outdated` показывают устаревшие мажоры.
---

# Dependency Freshness — обновление до реально последних версий

> Стек-специфичный скилл (в отличие от `.claude/rules/*`, которые веб-нейтральны). Команды ниже —
> для Pressmark: backend `src/Pressmark.Api` + `src/Pressmark.Api.Tests` (.NET/NuGet), frontend
> `src/pressmark-web` (npm), плюс Docker-образы и GitHub Actions (зона `devops`, но чек-лист тот
> же по духу — CI/registry не гарантируют «последнее» так же, как package-менеджеры не гарантируют).

## Когда применять
- Пользователь просит «обнови зависимости до последних», плановый maintenance-проход.
- `npm outdated` / `dotnet list package --outdated` показывают разрыв в MAJOR.
- Раз в квартал стоит явно сверить .NET SDK и React major, даже если ничего не «красное».

## Когда НЕ применять
- Точечный security-патч одного пакета (это делает обычный Dependabot-флоу, см. `security-engineer`).
- `npm install`/`dotnet add package <pkg>` без дальнейшей сверки — этого **недостаточно**: они
  берут последнюю версию, совместимую с уже закреплённым диапазоном/lock-файлом, а не обязательно
  самую свежую опубликованную. Именно поэтому этот скилл существует отдельным чек-листом.

## Почему обычные команды обновления не гарантируют «последнее»
- `npm install <pkg>` без версии — ставит `latest` **тег**, но если пакет уже в `package.json` с
  `^`-диапазоном, `npm install`/`npm ci` могут оставить закэшированную в lock-файле версию внутри
  диапазона, не дотягивая до самой новой опубликованной.
- `dotnet add package <pkg>` без `--version` — берёт последнюю версию, совместимую с текущим
  таргетом (TFM) и уже установленными пакетами; на мажорный breaking-релиз может не пойти сам.
- Dependabot по умолчанию поднимает PR на минимальный набор, закрывающий security-алерт или
  minor/patch — не всегда доводит до самого нового major.

## Backend (.NET / NuGet)

1. `dotnet list src/Pressmark.Api package --outdated --include-transitive` и то же для
   `src/Pressmark.Api.Tests` — покажет current/latest по каждому пакету, включая транзитивные.
2. Для каждого пакета с разрывом в MAJOR — открыть страницу пакета на nuget.org (или
   `dotnet package search <pkg>` / `dotnet nuget list source`), прочитать changelog/release notes:
   breaking changes, минимальный поддерживаемый TFM.
3. Обновлять поштучно (`dotnet add src/Pressmark.Api package <pkg> --version <latest>`), не пачкой —
   после каждого мажорного апдейта: `dotnet build --configuration Release` +
   `dotnet test --configuration Release` (см. Commands Reference в `CLAUDE.md`).
4. Проверить актуальность **.NET SDK** отдельно от NuGet-пакетов:
   - `dotnet --version` (установленный) vs https://dotnet.microsoft.com/en-us/download/dotnet
     (последний GA release канала, на котором сидит проект — см. `global.json` если есть, иначе TFM
     в `.csproj`, напр. `net10.0`).
   - Обновление major .NET (напр. .NET 10 → 11) — самостоятельная задача через `architect`
     (breaking changes рантайма, не просто пакет), не мешать в один PR с рутинным bump'ом пакетов.

## Frontend (npm)

1. `cd src/pressmark-web && npm outdated` — колонки `Current` / `Wanted` / `Latest`. `Wanted`
   — это то, что возьмёт обычный `npm update` (в пределах текущего `^`/`~` диапазона в
   `package.json`); `Latest` — реально самая новая опубликованная версия. Расхождение
   `Wanted` ≠ `Latest` = потенциальный мажорный/минорный апдейт, который сам `npm install` не сделает.
2. Для каждого пакета, где `Latest` выше `Wanted` (особенно MAJOR): `npm view <pkg> versions --json`
   — полный список опубликованных версий, чтобы увидеть pre-release/RC и настоящий последний
   стабильный тег, а не только то, что показал `outdated`.
3. Обновлять диапазон в `package.json` вручную на `^<latest>` (не полагаться на то, что
   `npm install <pkg>@latest` сам поправит semver-диапазон в манифесте так, как ожидается), затем
   `npm install` для перегенерации `package-lock.json`.
4. После каждого мажорного апдейта прогонять весь набор проверок из Commands Reference: `npm run
   typecheck`, `npm run lint`, `npm run test`, `npm run build` — мажоры чаще всего ломают типы или
   рантайм-поведение незаметно для линтера.
5. **React major** — сверять отдельно и явно: `npm view react versions --json` /
   https://react.dev/versions. Апдейт React major (и синхронно `react-dom`, `@types/react`,
   `@types/react-dom`) — самостоятельная задача через `architect` (новые API, deprecations),
   не в одном PR с рутинными bump'ами остальных пакетов.
6. Проверить транзитивные зависимости, у которых прямого пакета-владельца нет в `package.json`
   (напр. dev-tooling вроде `shadcn` → `@modelcontextprotocol/sdk` → `@hono/node-server`): если
   родитель сам капает версию через `^`-диапазон ниже реально пропатченной, обычный bump не
   поможет — нужен `overrides` в `package.json` (см. пример уже применённого override для
   `@hono/node-server`), с проверкой, что затронутый dev-инструмент всё ещё работает
   (`npx <tool> --help` и т.п.), а не только что `npm install` прошёл без ошибок.

## Docker-образы

Роль: `devops` (не покрывается `repo-scout` — тот смотрит только пакетные менеджеры, не registry).
Текущий набор образов и почему разные Dockerfile обязаны совпадать по версии — см. «Карта CI/CD
этого проекта» в `agents/devops.md`, здесь — только чек-лист свежести:

1. Для каждого базового образа (`src/Pressmark.Api/Dockerfile`,
   `src/pressmark-web/Dockerfile`) сверь тег с реально доступными в registry — `docker manifest
   inspect <image>:<tag>` или страница тегов на Docker Hub/`mcr.microsoft.com`, не полагайся на то,
   что тег вида `10.0`/`24-alpine` сам «подтянется»: он **пиновый**, и Dependabot по нему
   молчит, пока explicit-версия совпадает по паттерну.
2. **Node — сверяй LTS-статус, не только номер версии**: https://nodejs.org/en/about/previous-releases
   — берём Active LTS, не «Current»/pre-LTS и не затухающую «Maintenance». `node:26-alpine` в
   Dockerfile при `ci.yml` на Node 24 — реальный прецедент рассинхрона (прод собирался на
   незрелой версии, которую CI не проверял вообще), см. `agents/devops.md`.
3. **.NET SDK/runtime образы** — тег обязан совпадать с TFM в `.csproj` (`net10.0` →
   `mcr.microsoft.com/dotnet/sdk:10.0`/`aspnet:10.0`); апдейт major .NET — самостоятельная задача
   через `architect`, не рутинный bump образа.
4. При апдейте Node/.NET — меняй **оба места одним PR**: Dockerfile и `ci.yml`'s
   `node-version`/`dotnet-version` — расхождение означает, что прод собирается на версии, которую
   CI не тестирует вообще.

## GitHub Actions

Роль: `devops`. Dependabot **не берёт мажоры GitHub Actions сам** (держится совместимой, не
обязательно последней версии) — обновляй вручную:

1. Для каждого action в `.github/workflows/*.yml` (`actions/checkout`, `actions/setup-dotnet`,
   `actions/setup-node`, `docker/build-push-action`, `docker/metadata-action`, `docker/login-action`,
   `aquasecurity/trivy-action` и т.п.) — сверь закреплённую версию с последним релизом на странице
   action на GitHub Marketplace/репозитория (`Releases`), не с тем, что подсказывает автокомплит.
2. Мажорный апдейт action — читай `Releases`/`CHANGELOG` на breaking changes во входных/выходных
   параметрах (`with:`/`outputs:`), не просто меняй номер версии в `uses:`.
3. После апдейта — обязательный прогон workflow (push в ветку или `workflow_dispatch`, если
   доступен) до мержа, не полагайся на то, что синтаксис не изменился.

## Итоговый чек-лист

- [ ] `dotnet list package --outdated --include-transitive` прогнан для обоих `.csproj`.
- [ ] Каждый MAJOR-разрыв в NuGet сверен с release notes на nuget.org, апдейт сделан отдельно,
      билд+тесты зелёные после каждого.
- [ ] `dotnet --version` сверена с последним GA .NET SDK; апгрейд SDK/TFM — отдельная задача.
- [ ] `npm outdated` прогнан; для каждого `Latest` > `Wanted` сверено через `npm view <pkg>
      versions --json`.
- [ ] React/react-dom major сверен отдельно с react.dev/versions; апгрейд — отдельная задача
      через `architect`, если major.
- [ ] Транзитивные зависимости без прямого владельца в `package.json` проверены на
      необходимость `overrides`.
- [ ] После апдейтов: `npm run typecheck && npm run lint && npm run test && npm run build` и
      `dotnet build --configuration Release && dotnet test --configuration Release` — всё зелёное
      (делегировать `build-validator`).
- [ ] Базовые образы Docker сверены с registry (не только с тегом-паттерном), Node/.NET SDK версии
      совпадают между Dockerfile и `ci.yml` (`devops`).
- [ ] Версии GitHub Actions в `.github/workflows/*.yml` сверены с последними релизами, мажоры
      апдейчены вручную с проверкой breaking changes (`devops`).

## Связанные роли и правила
- `repo-scout` — read-only снимок устаревших пакетов (`dotnet list --outdated`/`npm outdated`)
  одним проходом в начале `/maintain`, отправная точка для этого чек-листа вместо повторного
  запуска тех же команд вручную. Docker-образы и GitHub Actions `repo-scout` не покрывает — это
  делает `devops` вручную по разделам выше.
- `build-validator` — прогон проверок после каждого апдейта, без замусоривания контекста.
- `architect` — решение по мажорным/фреймворк-апдейтам с breaking changes.
- `security-engineer` — если апдейт закрывает Dependabot security alert, свериться, что версия
  действительно патчит advisory (не просто «новее»).
- `devops` — владелец разделов «Docker-образы» и «GitHub Actions» выше.

## Definition of Done
Все пакеты сверены с реально последними опубликованными версиями (не только с тем, что подтянул бы
`npm install`/`dotnet add package` вслепую), мажорные апдейты и апдейт .NET SDK/React обособлены в
свои задачи с обоснованием, билд/линт/тесты зелёные после каждого шага.
