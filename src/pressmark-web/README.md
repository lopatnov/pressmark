# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Linting

Linting is done with [oxlint](https://oxc.rs/docs/guide/usage/linter) (`npm run lint`). The rules live in `.oxlintrc.json` and mirror the former ESLint setup: the `typescript-eslint` recommended set plus `react/only-export-components`. oxlint does not use the TypeScript compiler API, so it keeps working with TypeScript 7. Type-aware rules are available through `oxlint-tsgolint` ([docs](https://oxc.rs/docs/guide/usage/linter/type-aware.html)) if they are ever needed.
