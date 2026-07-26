# Внутренняя документация для Claude

Это внутренняя память Claude (не документация продукта — та у `technical-writer`). Файлы здесь
ведёт и поддерживает роль `manager`. Документация создаётся по мере необходимости.

## Карта `.claude/` (для дирижёра)

```
.claude/
├── rules/
│   ├── index.md       — ценности, дисциплина билдов, экономия, ревью PR; точка входа в правила
│   ├── workflow.md    — жизненный цикл задачи, ворота, триггеры, примеры прохода, DoD
│   ├── team.md        — роли, субординация, RACI, политика моделей и инструментов
│   └── conventions.md — коммиты, версии, ветки, changelog, PR-чеклист
├── agents/
│   ├── _TEMPLATE.md   — канонический шаблон агента (копировать при создании нового)
│   ├── <core>.md      — лин-ядро (architect, scrum-master, manager, server-developer, tester,
│   │                    business-analyst, designer, ui-developer, manual-tester,
│   │                    security-engineer, technical-writer, devops, build-validator)
│   └── <optional>.md  — опциональные роли-стабы (qa, release-engineer, lawyer, translator)
├── commands/
│   └── build.md       — /build: проверка сборки/линта/тестов через build-validator
├── skills/
│   ├── _TEMPLATE/               — канонический шаблон скилла (копировать при создании нового)
│   ├── testing/                 — плейбук тестирования (стратегия + роли tester/manual-tester)
│   └── dependency-freshness/    — чек-лист обновления зависимостей до реально последних версий
│                                  (включая мажоры, .NET SDK, React) — не только Dependabot-патчи
├── backlog/
│   ├── roadmap.md     — фазы верхнего уровня; фичи-беклог живёт в GitHub Issues проекта
│   ├── tasks.md       — активный спринт (сессионные задачи Claude)
│   └── completed/     — выполненное за сессию (non-released.md); релизы — в корневом CHANGELOG.md
└── docs/
    ├── index.md               — этот файл
    └── extending-the-app.md   — как добавить новый gRPC-эндпоинт / новую страницу, по образцу
                                  существующего кода
```

## Порядок чтения при старте сессии
`CLAUDE.md` → `rules/index.md` → `rules/workflow.md` → `rules/team.md`. Дальше — профильные
файлы агентов по мере вызова ролей.

## Переиспользование в других проектах
Ядро (`agents/*`, `rules/workflow.md`, `rules/team.md`, `_TEMPLATE.md`, `docs/index.md`) —
веб-нейтральное и копируется как есть. Специфика проекта живёт в `CLAUDE.md` (и опциональном
`rules/project.md`), а не в ядре.
