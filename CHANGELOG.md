# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/) and this project adheres
to [Semantic Versioning](https://semver.org/) once it reaches 1.0.0.

## [0.1.0] - 2026-10-21

First maintainable release. Rebuilt the package around a single TypeScript core
that is bundled by `esbuild` into UMD, ESM and minified variants; the Vue
component is now a thin host around that core.

### Added
- TypeScript source in `src/` with a single `XqShare` core shared by the UMD,
  ESM and Vue builds.
- `scripts/build.mjs`: builds 6 JS variants, 2 CSS variants, `lib/types`,
  `lib/vue` and copies `lib/img`; fails the build if the UMD contains
  `import.meta` or the ESM loses its icon-base detection.
- Bundled share icons under `lib/img/` (no third-party CDN at runtime);
  `iconBase` option overrides the directory.
- Instance-scoped rendering and event handling — every lookup is scoped to the
  instance root and every listener is owned by a `ListenerBag`, so several
  widgets on one page no longer collide.
- Public API: `show()`, `hide()`, `toggle()`, `share()`, `copy()` (returns a
  `Promise`), `setUrl()`, `update()`, `destroy()`, plus `element` / `visible` /
  `mode` / `options` getters.
- Proper `encodeURIComponent` for URLs and titles; full description support
  (`desc`); `wechat` copies the link instead of opening a blank tab; unknown
  targets are reported via `onError` instead of throwing.
- Accessibility: `role="dialog"` + `aria-modal` on the `pop` overlay, semantic
  `<button>` triggers, `aria-expanded` on the slide toggle, `Esc` to close,
  backdrop click to close, and a body scroll lock while `pop` is open.
- Clipboard writes prefer `navigator.clipboard` and fall back to
  `execCommand('copy')`; a status line replaces the old `alert()`.
- `package.json` `exports` map with `types`/`import`/`require` conditions, plus
  `module`, `browser`, `unpkg`, `jsdelivr`, `types`, `engines` and `files`.
- Published type declarations under `lib/types/`.
- Self-check tooling: `test/` pages (browser, esm, vue2, vue3) with inline
  PASS/FAIL, a zero-dependency `demo-server.mjs`, and a headless
  `test-browser.mjs` run over the Chrome/Edge DevTools Protocol.
- Node tests (`test/*.test.mjs`) covering the share URL builder, bundle
  behaviour, package wiring, Vue wiring and page structure.

### Changed
- `main` now points at the real UMD build (`lib/js/xqshare.js`) instead of the
  raw `.vue` file, so `require('xqshare')` works.
- Vue component registered as `xqShare` (`<xq-share>`); `v-model` / `:show` both
  bind visibility and emit `update:*` events.
- Build target raised to **ES2018**; IE is no longer supported.
- Slide mode sits at the upper-middle of the right viewport edge (`top: 30%`)
  instead of dead-center.

### Fixed
- Strict-mode `event` global reference that crashed the ESM build in Firefox.
- Duplicate fixed `id`s (`previewUrl`, `iframeUrl`, …) that produced invalid HTML
  and copied the wrong instance.
- Silent mount onto `document.documentElement` when the host selector matched
  nothing.
- `transition: all` animating `right` (layout thrash) and missing `<img>`
  dimensions (CLS).

### Migration
See `README.md` / `zh.md` "Migrating from 0.0.x" for the breaking changes and the
`exports` redirect for the old `xqshare/lib/vue/index.vue` path.
